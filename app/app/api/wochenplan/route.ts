import { NextRequest, NextResponse } from 'next/server'
import { ladeWochenAnsicht, speichereWochenplan } from '@/lib/wochenplan'
import { supabase } from '@/lib/supabase-server'
import { berechneListeFuerPlan } from '@/lib/einkaufsliste-berechnen'
import { upsertListe } from '@/lib/einkaufsliste-persistence'
import { ladeVorrat } from '@/lib/vorrat'
import { ladeExtrasForPlan } from '@/lib/extras'
import type { WochenplanEintrag, Gericht, Regelbedarf, EinkaufsItem, Wochenplan } from '@/types'

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
    }

    return NextResponse.json(plan)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
