import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { ladeWochenAnsicht } from '@/lib/wochenplan'
import { ladeListe, markiereAlsGesendet } from '@/lib/einkaufsliste-persistence'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { zumWarenkorb, warenkorbLeeren } from '@/lib/picnic'
import { ladeVorrat, aktualisiereVorrat, parsePaketgroesse, normalisiereEinheit, istTracked } from '@/lib/vorrat'
import type { Gericht } from '@/types'

async function mitRetry<T>(fn: () => Promise<T>, versuche = 3): Promise<T> {
  for (let i = 0; i < versuche; i++) {
    try { return await fn() } catch (e) {
      if (i === versuche - 1) throw e
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw new Error('Unreachable')
}

export async function POST() {
  try {
    const { aktiverPlan: plan } = await ladeWochenAnsicht()
    if (!plan) return NextResponse.json({ error: 'Kein Wochenplan für diese Woche gefunden' }, { status: 404 })

    const liste = await ladeListe(plan.id)
    if (!liste) return NextResponse.json({ error: 'Einkaufsliste wurde noch nicht berechnet' }, { status: 404 })
    if (liste.gesendet_am !== null) {
      return NextResponse.json({ error: 'Einkaufsliste wurde bereits gesendet' }, { status: 409 })
    }

    const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
    const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'

    await warenkorbLeeren()
    for (const p of liste.picnic) {
      await zumWarenkorb(p.artikelId, 1)
    }

    await Promise.all([
      mitRetry(() => aktualisiereEinkaufsliste(listName1, liste.bring1)),
      mitRetry(() => aktualisiereEinkaufsliste(listName2, liste.bring2)),
    ])

    const { data: gerichte } = await supabase.from('gerichte').select('*')
    const vorrat = await ladeVorrat()
    const haltbarkeitMap = new Map<string, number>()
    for (const g of (gerichte ?? []) as Gericht[]) {
      for (const z of g.zutaten) haltbarkeitMap.set(z.name.toLowerCase(), z.haltbarkeit_tage)
    }
    const kaufeFuerVorrat = liste.picnic
      .filter(p => istTracked(haltbarkeitMap.get(p.picnicProdukt.toLowerCase()) ?? 0))
      .map(p => ({
        zutat_name: p.picnicProdukt.toLowerCase(),
        paket: parsePaketgroesse(p.picnicProdukt),
        verbrauch: normalisiereEinheit(p.menge, p.einheit),
      }))
    const ausVorratFuerUpdate = liste.aus_vorrat.map(item => ({
      zutat_name: item.name.toLowerCase(),
      verbrauch: normalisiereEinheit(item.menge, item.einheit),
    }))
    await aktualisiereVorrat(vorrat, kaufeFuerVorrat, ausVorratFuerUpdate)

    await markiereAlsGesendet(plan.id, {
      picnic: liste.picnic,
      bring1: liste.bring1,
      bring2: liste.bring2,
    })

    await supabase.from('picnic_bestellung_status').upsert(
      {
        wochenplan_id: plan.id,
        gesendete_produkte: liste.picnic.map(p => p.picnicProdukt),
        bestellung_erkannt: false,
        bestellung_id: null,
        fehlende_produkte: [],
        geprueft_am: null,
      },
      { onConflict: 'wochenplan_id' }
    )

    return NextResponse.json({
      einkauf1Count: liste.bring1.length,
      einkauf2Count: liste.bring2.length,
      picnic1Count: liste.picnic.length,
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
