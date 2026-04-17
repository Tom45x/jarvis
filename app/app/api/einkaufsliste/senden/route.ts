import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { generiereEinkaufslisten, splitNachRouting, aggregiere } from '@/lib/einkaufsliste'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { sucheArtikel, zumWarenkorb, warenkorbLeeren } from '@/lib/picnic'
import { ladeWochenAnsicht } from '@/lib/wochenplan'
import { ladeExtrasForPlan } from '@/lib/extras'
import { ladeVorrat, aktualisiereVorrat, parsePaketgroesse, normalisiereEinheit, istTracked } from '@/lib/vorrat'
import type { Gericht, EinkaufsItem, Regelbedarf } from '@/types'

async function ladePicnicEinstellungen(): Promise<{
  mindestbestellwert: number
  bringKeywords: string[]
}> {
  const { data } = await supabase
    .from('einstellungen')
    .select('key, value')
    .in('key', ['picnic_mindestbestellwert', 'picnic_bring_keywords'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return {
    mindestbestellwert: parseInt(map['picnic_mindestbestellwert'] ?? '35', 10),
    bringKeywords: (() => { try { return JSON.parse(map['picnic_bring_keywords'] ?? '[]') as string[] } catch { return [] } })(),
  }
}

async function ladeRegelbedarf(): Promise<Regelbedarf[]> {
  const { data } = await supabase.from('regelbedarf').select('*')
  return (data ?? []) as Regelbedarf[]
}

async function ladeExtrasZutaten(wochenplanId: string): Promise<EinkaufsItem[]> {
  const extras = await ladeExtrasForPlan(wochenplanId)
  const katalogIds = extras.map(e => e.katalog_id).filter((id): id is string => id !== null)
  if (katalogIds.length === 0) return []

  const { data, error } = await supabase
    .from('extras_katalog')
    .select('zutaten')
    .in('id', katalogIds)
  if (error) throw error

  const items: EinkaufsItem[] = []
  for (const row of data ?? []) {
    const zutaten = (row.zutaten ?? []) as Array<{ name: string; menge: number; einheit: string }>
    for (const z of zutaten) {
      items.push({ name: z.name, menge: z.menge, einheit: z.einheit })
    }
  }
  return items
}

async function mitRetry<T>(fn: () => Promise<T>, versuche = 3): Promise<T> {
  for (let i = 0; i < versuche; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i === versuche - 1) throw e
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw new Error('Unreachable')
}

async function verarbeitePicnicListe(
  picnicKandidaten: EinkaufsItem[],
  mindestbestellwert: number
): Promise<{
  zuPicnic: Array<{ item: EinkaufsItem; artikelId: string; picnicProdukt: string }>
  zuBring: EinkaufsItem[]
  gesamtpreisEuro: number
}> {
  const gefunden: Array<{ item: EinkaufsItem; artikelId: string; preisCent: number; picnicProdukt: string }> = []
  const nichtGefunden: EinkaufsItem[] = []

  await Promise.all(
    picnicKandidaten.map(async (item) => {
      const artikel = await sucheArtikel(item.name)
      if (artikel) {
        gefunden.push({ item, artikelId: artikel.artikelId, preisCent: artikel.preis, picnicProdukt: artikel.name })
      } else {
        nichtGefunden.push(item)
      }
    })
  )

  const gesamtpreisEuro = gefunden.reduce((sum, g) => sum + g.preisCent / 100, 0)

  if (gesamtpreisEuro < mindestbestellwert) {
    return {
      zuPicnic: [],
      zuBring: [...picnicKandidaten],
      gesamtpreisEuro,
    }
  }

  return {
    zuPicnic: gefunden.map(g => ({ item: g.item, artikelId: g.artikelId, picnicProdukt: g.picnicProdukt })),
    zuBring: nichtGefunden,
    gesamtpreisEuro,
  }
}

async function fuellePicnicWarenkorb(items: Array<{ item: EinkaufsItem; artikelId: string }>): Promise<void> {
  for (const { artikelId } of items) {
    await zumWarenkorb(artikelId, 1)
  }
}

export async function POST() {
  try {
    const { aktiverPlan: plan } = await ladeWochenAnsicht()
    if (!plan) {
      return NextResponse.json(
        { error: 'Kein Wochenplan für diese Woche gefunden' },
        { status: 404 }
      )
    }

    const [{ data: gerichte }, einstellungen, regelbedarf, vorrat] = await Promise.all([
      supabase.from('gerichte').select('*'),
      ladePicnicEinstellungen(),
      ladeRegelbedarf(),
      ladeVorrat(),
    ])

    if (!gerichte) {
      return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
    }

    const einkaufstag2Raw = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
    const einkaufstag2 = isNaN(einkaufstag2Raw) ? 4 : einkaufstag2Raw
    const regelbedarfNamen = regelbedarf.map(r => r.name)
    const { einkauf1, einkauf2, ausVorrat } = generiereEinkaufslisten(
      plan.eintraege,
      gerichte as Gericht[],
      einkaufstag2,
      regelbedarfNamen,
      vorrat
    )

    const extrasZutaten = await ladeExtrasZutaten(plan.id)
    const einkauf1MitExtras = aggregiere([...einkauf1, ...extrasZutaten])
    const routing1 = splitNachRouting(einkauf1MitExtras, einstellungen.bringKeywords)
    const picnic1Ergebnis = await verarbeitePicnicListe(routing1.picnic, einstellungen.mindestbestellwert)
    const bring1Gesamt = [...routing1.bring, ...picnic1Ergebnis.zuBring]
    const bring2Gesamt = [...einkauf2]

    const regelbedarfItems: EinkaufsItem[] = regelbedarf.map(r => ({
      name: r.name,
      menge: r.menge,
      einheit: r.einheit,
    }))
    const regelbedarfErgebnisse = await Promise.all(
      regelbedarfItems.map(async (r) => {
        const artikel = await sucheArtikel(r.name)
        return artikel ? { item: r, artikelId: artikel.artikelId, picnicProdukt: artikel.name } : null
      })
    )
    const regelbedarfPicnicItems = regelbedarfErgebnisse.filter(
      (r): r is { item: EinkaufsItem; artikelId: string; picnicProdukt: string } => r !== null
    )

    await warenkorbLeeren()
    await fuellePicnicWarenkorb([
      ...picnic1Ergebnis.zuPicnic,
      ...regelbedarfPicnicItems,
    ])

    const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
    const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'

    await Promise.all([
      mitRetry(() => aktualisiereEinkaufsliste(listName1, bring1Gesamt)),
      mitRetry(() => aktualisiereEinkaufsliste(listName2, bring2Gesamt)),
    ])

    // Vorrat aktualisieren: nur tracked Picnic-Artikel (haltbarkeit >= 14)
    const haltbarkeitMap = new Map<string, number>()
    for (const g of gerichte as Gericht[]) {
      for (const z of g.zutaten) {
        haltbarkeitMap.set(z.name.toLowerCase(), z.haltbarkeit_tage)
      }
    }

    const kaufeFuerVorrat = picnic1Ergebnis.zuPicnic
      .filter(p => istTracked(haltbarkeitMap.get(p.item.name.toLowerCase()) ?? 0))
      .map(p => ({
        zutat_name: p.item.name.toLowerCase(),
        paket: parsePaketgroesse(p.picnicProdukt),
        verbrauch: normalisiereEinheit(p.item.menge, p.item.einheit),
      }))

    const ausVorratFuerUpdate = ausVorrat.map(item => ({
      zutat_name: item.name.toLowerCase(),
      verbrauch: normalisiereEinheit(item.menge, item.einheit),
    }))

    await aktualisiereVorrat(vorrat, kaufeFuerVorrat, ausVorratFuerUpdate)

    const picnicListenItems = [
      ...picnic1Ergebnis.zuPicnic.map(p => ({ picnicProdukt: p.picnicProdukt, menge: p.item.menge, einheit: p.item.einheit })),
      ...regelbedarfPicnicItems.map(p => ({ picnicProdukt: p.picnicProdukt, menge: p.item.menge, einheit: p.item.einheit })),
    ]

    return NextResponse.json({
      einkauf1Count: bring1Gesamt.length,
      einkauf2Count: bring2Gesamt.length,
      picnic1Count: picnicListenItems.length,
      picnic1Fallback: picnic1Ergebnis.zuPicnic.length === 0 && routing1.picnic.length > 0,
      listen: {
        picnic: picnicListenItems,
        bring1: bring1Gesamt,
        bring2: bring2Gesamt,
        ausVorrat,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    const istTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('blocking read')
    return NextResponse.json(
      { error: istTimeout ? 'Verbindung fehlgeschlagen — bitte erneut versuchen' : (msg || 'Unbekannter Fehler') },
      { status: 500 }
    )
  }
}
