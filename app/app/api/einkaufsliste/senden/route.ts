import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { generiereEinkaufslisten, splitNachRouting } from '@/lib/einkaufsliste'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { sucheArtikel, zumWarenkorb, warenkorbLeeren } from '@/lib/picnic'
import { ladeAktuellenWochenplan } from '@/lib/wochenplan'
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
): Promise<{ zuPicnic: Array<{ item: EinkaufsItem; artikelId: string }>; zuBring: EinkaufsItem[]; gesamtpreisEuro: number }> {
  const gefunden: Array<{ item: EinkaufsItem; artikelId: string; preisCent: number }> = []
  const nichtGefunden: EinkaufsItem[] = []

  await Promise.all(
    picnicKandidaten.map(async (item) => {
      const artikel = await sucheArtikel(item.name)
      if (artikel) {
        gefunden.push({ item, artikelId: artikel.artikelId, preisCent: artikel.preis })
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
    zuPicnic: gefunden.map(g => ({ item: g.item, artikelId: g.artikelId })),
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
    const plan = await ladeAktuellenWochenplan()
    if (!plan) {
      return NextResponse.json(
        { error: 'Kein Wochenplan für diese Woche gefunden' },
        { status: 404 }
      )
    }

    const [{ data: gerichte }, einstellungen, regelbedarf] = await Promise.all([
      supabase.from('gerichte').select('*'),
      ladePicnicEinstellungen(),
      ladeRegelbedarf(),
    ])

    if (!gerichte) {
      return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
    }

    const einkaufstag2Raw = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
    const einkaufstag2 = isNaN(einkaufstag2Raw) ? 4 : einkaufstag2Raw
    const regelbedarfNamen = regelbedarf.map(r => r.name)
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(
      plan.eintraege,
      gerichte as Gericht[],
      einkaufstag2,
      regelbedarfNamen
    )

    // Einkauf 1: Bring-Keywords → Bring, Rest → Picnic-Suche
    const routing1 = splitNachRouting(einkauf1, einstellungen.bringKeywords)
    const picnic1Ergebnis = await verarbeitePicnicListe(routing1.picnic, einstellungen.mindestbestellwert)
    const bring1Gesamt = [...routing1.bring, ...picnic1Ergebnis.zuBring]

    // Einkauf 2: komplett zu Bring (zu wenige Artikel für Picnic-Mindestbestellwert)
    const bring2Gesamt = [...einkauf2]

    // Regelbedarf: nur für Einkauf 1 → Picnic (parallelisiert)
    const regelbedarfItems: EinkaufsItem[] = regelbedarf.map(r => ({
      name: r.name,
      menge: r.menge,
      einheit: r.einheit,
    }))
    const regelbedarfErgebnisse = await Promise.all(
      regelbedarfItems.map(async (r) => {
        const artikel = await sucheArtikel(r.name)
        return artikel ? { item: r, artikelId: artikel.artikelId } : null
      })
    )
    const regelbedarfPicnicItems = regelbedarfErgebnisse.filter(
      (r): r is { item: EinkaufsItem; artikelId: string } => r !== null
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

    const picnicItems = [
      ...picnic1Ergebnis.zuPicnic.map(p => p.item),
      ...regelbedarfPicnicItems.map(p => p.item),
    ]

    return NextResponse.json({
      einkauf1Count: bring1Gesamt.length,
      einkauf2Count: bring2Gesamt.length,
      picnic1Count: picnicItems.length,
      picnic1Fallback: picnic1Ergebnis.zuPicnic.length === 0 && routing1.picnic.length > 0,
      listen: {
        picnic: picnicItems,
        bring1: bring1Gesamt,
        bring2: bring2Gesamt,
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
