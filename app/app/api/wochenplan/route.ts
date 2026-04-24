import { NextRequest, NextResponse } from 'next/server'
import { ladeWochenAnsicht, speichereWochenplan } from '@/lib/wochenplan'
import { supabase } from '@/lib/supabase-server'
import { berechneListeFuerPlan } from '@/lib/einkaufsliste-berechnen'
import {
  ladeListe,
  upsertListe,
  aktualisiereSektionen,
  aktualisiereSnapshotTeilweise,
  setzeSyncFehler,
} from '@/lib/einkaufsliste-persistence'
import {
  bestimmeEinfrierstatus,
  istGleichBring,
  istGleichPicnic,
  berechneBringDiff,
  berechnePicnicDiff,
} from '@/lib/einkaufsliste-diff'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { zumWarenkorb, warenkorbLeeren } from '@/lib/picnic'
import { ladeVorrat } from '@/lib/vorrat'
import { ladeExtrasForPlan } from '@/lib/extras'
import type {
  WochenplanEintrag,
  Gericht,
  Regelbedarf,
  EinkaufsItem,
  Wochenplan,
  Einkaufsliste,
  EinkaufslisteSnapshot,
  ListenDiff,
} from '@/types'

export async function GET() {
  const ansicht = await ladeWochenAnsicht()
  return NextResponse.json(ansicht)
}

async function ladePicnicEinstellungen() {
  const { data } = await supabase
    .from('einstellungen')
    .select('key, value')
    .in('key', ['picnic_mindestbestellwert', 'picnic_bring_keywords'])
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return {
    mindestbestellwert: parseInt(map['picnic_mindestbestellwert'] ?? '35', 10),
    bringKeywords: (() => {
      try { return JSON.parse(map['picnic_bring_keywords'] ?? '[]') as string[] } catch { return [] }
    })(),
  }
}

async function ladeRegelbedarf(): Promise<Regelbedarf[]> {
  const { data } = await supabase.from('regelbedarf').select('*')
  return (data ?? []) as Regelbedarf[]
}

async function ladeExtrasZutatenFuerPlan(wochenplanId: string): Promise<EinkaufsItem[]> {
  const extras = await ladeExtrasForPlan(wochenplanId)
  const ids = extras.map(e => e.katalog_id).filter((i): i is string => i !== null)
  if (ids.length === 0) return []
  const { data } = await supabase.from('extras_katalog').select('zutaten').in('id', ids)
  const items: EinkaufsItem[] = []
  for (const row of data ?? []) {
    const zutaten = (row.zutaten ?? []) as Array<{ name: string; menge: number; einheit: string }>
    for (const z of zutaten) items.push({ name: z.name, menge: z.menge, einheit: z.einheit })
  }
  return items
}

async function berechneUndPersistiere(plan: Wochenplan, gestrichen: string[] = []) {
  const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
  const [{ data: gerichte }, einstellungen, regelbedarf, vorrat, extrasZutaten] = await Promise.all([
    supabase.from('gerichte').select('*'),
    ladePicnicEinstellungen(),
    ladeRegelbedarf(),
    ladeVorrat(),
    ladeExtrasZutatenFuerPlan(plan.id),
  ])

  const listen = await berechneListeFuerPlan({
    eintraege: plan.eintraege,
    gerichte: (gerichte ?? []) as Gericht[],
    einkaufstag2,
    regelbedarf,
    vorrat,
    bringKeywords: einstellungen.bringKeywords,
    mindestbestellwert: einstellungen.mindestbestellwert,
    extrasZutaten,
    gestrichen,
  })

  await upsertListe({
    wochenplan_id: plan.id,
    picnic: listen.picnic,
    bring1: listen.bring1,
    bring2: listen.bring2,
    aus_vorrat: listen.ausVorrat,
    gestrichen,
  })
}

async function ladeBestellStatus(wochenplanId: string): Promise<boolean> {
  const { data } = await supabase
    .from('picnic_bestellung_status')
    .select('bestellung_erkannt')
    .eq('wochenplan_id', wochenplanId)
    .maybeSingle()
  return Boolean(data?.bestellung_erkannt)
}

async function fuehreDiffUpdateDurch(
  liste: Einkaufsliste,
  neu: {
    picnic: Einkaufsliste['picnic']
    bring1: Einkaufsliste['bring1']
    bring2: Einkaufsliste['bring2']
    aus_vorrat: Einkaufsliste['aus_vorrat']
  }
): Promise<ListenDiff> {
  const einkaufstag1 = parseInt(process.env.EINKAUFSTAG_1 ?? '1', 10)
  const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
  const picnicBestellt = await ladeBestellStatus(liste.wochenplan_id)
  const frozen = bestimmeEinfrierstatus(new Date(), einkaufstag1, einkaufstag2, picnicBestellt)

  const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
  const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'
  const snapshot = liste.gesendet_snapshot as EinkaufslisteSnapshot

  const diffs: ListenDiff = {}
  const neuerSnapshot: Partial<EinkaufslisteSnapshot> = {}

  if (!frozen.bring1Frozen && !istGleichBring(snapshot.bring1, neu.bring1)) {
    try {
      await aktualisiereEinkaufsliste(listName1, neu.bring1)
      diffs.bring1 = berechneBringDiff(snapshot.bring1, neu.bring1)
      neuerSnapshot.bring1 = neu.bring1
    } catch (e) {
      await setzeSyncFehler(liste.wochenplan_id, {
        sektion: 'bring1',
        fehler: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      })
    }
  }

  if (!frozen.bring2Frozen && !istGleichBring(snapshot.bring2, neu.bring2)) {
    try {
      await aktualisiereEinkaufsliste(listName2, neu.bring2)
      diffs.bring2 = berechneBringDiff(snapshot.bring2, neu.bring2)
      neuerSnapshot.bring2 = neu.bring2
    } catch (e) {
      await setzeSyncFehler(liste.wochenplan_id, {
        sektion: 'bring2',
        fehler: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      })
    }
  }

  if (!frozen.picnicFrozen && !istGleichPicnic(snapshot.picnic, neu.picnic)) {
    try {
      await warenkorbLeeren()
      for (const p of neu.picnic) {
        await zumWarenkorb(p.artikelId, 1)
      }
      diffs.picnic = berechnePicnicDiff(snapshot.picnic, neu.picnic)
      neuerSnapshot.picnic = neu.picnic
    } catch (e) {
      await setzeSyncFehler(liste.wochenplan_id, {
        sektion: 'picnic',
        fehler: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      })
    }
  }

  await aktualisiereSektionen(liste.wochenplan_id, {
    picnic: neu.picnic,
    bring1: neu.bring1,
    bring2: neu.bring2,
    aus_vorrat: neu.aus_vorrat,
  })

  if (Object.keys(neuerSnapshot).length > 0) {
    await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, neuerSnapshot)
  }

  return diffs
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })

  const { eintraege, status }: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' } = body
  if (!Array.isArray(eintraege)) {
    return NextResponse.json({ error: 'eintraege muss ein Array sein' }, { status: 400 })
  }
  if (status !== 'entwurf' && status !== 'genehmigt') {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  try {
    const { aktiverPlan: vorher } = await ladeWochenAnsicht()
    const plan = await speichereWochenplan(eintraege, status)

    const wechseltZuGenehmigt = status === 'genehmigt' && (!vorher || vorher.status !== 'genehmigt')
    if (wechseltZuGenehmigt) {
      await berechneUndPersistiere(plan, [])
      return NextResponse.json(plan)
    }

    if (status === 'genehmigt') {
      const liste = await ladeListe(plan.id)
      if (liste && liste.gesendet_am === null) {
        await berechneUndPersistiere(plan, liste.gestrichen)
      } else if (liste && liste.gesendet_am !== null && liste.gesendet_snapshot) {
        const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
        const [{ data: gerichte }, einstellungen, regelbedarf, vorrat, extrasZutaten] = await Promise.all([
          supabase.from('gerichte').select('*'),
          ladePicnicEinstellungen(),
          ladeRegelbedarf(),
          ladeVorrat(),
          ladeExtrasZutatenFuerPlan(plan.id),
        ])
        const neueListen = await berechneListeFuerPlan({
          eintraege: plan.eintraege,
          gerichte: (gerichte ?? []) as Gericht[],
          einkaufstag2,
          regelbedarf,
          vorrat,
          bringKeywords: einstellungen.bringKeywords,
          mindestbestellwert: einstellungen.mindestbestellwert,
          extrasZutaten,
          gestrichen: liste.gestrichen,
        })
        const diffs = await fuehreDiffUpdateDurch(liste, {
          picnic: neueListen.picnic,
          bring1: neueListen.bring1,
          bring2: neueListen.bring2,
          aus_vorrat: neueListen.ausVorrat,
        })
        return NextResponse.json({ ...plan, einkaufslisten_diff: diffs })
      }
    }

    return NextResponse.json(plan)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
