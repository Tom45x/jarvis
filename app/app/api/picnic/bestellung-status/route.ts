import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { ladeAktuelleBestellung } from '@/lib/picnic'
import { ladeWochenAnsicht } from '@/lib/wochenplan'

const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 Stunden

function normalisiereProduktname(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

export async function GET() {
  try {
    const { aktiverPlan } = await ladeWochenAnsicht()
    if (!aktiverPlan) {
      return NextResponse.json({ status: 'kein_plan' })
    }

    const { data: snapshot } = await supabase
      .from('picnic_bestellung_status')
      .select('*')
      .eq('wochenplan_id', aktiverPlan.id)
      .single()

    if (!snapshot) {
      return NextResponse.json({ status: 'keine_liste' })
    }

    // Cache nutzen wenn frisch genug
    const geprueftAm = snapshot.geprueft_am ? new Date(snapshot.geprueft_am).getTime() : 0
    if (Date.now() - geprueftAm < CACHE_TTL_MS) {
      return NextResponse.json({
        status: snapshot.bestellung_erkannt ? 'bestellt' : 'offen',
        fehlende_produkte: snapshot.fehlende_produkte ?? [],
        gesendete_anzahl: (snapshot.gesendete_produkte ?? []).length,
      })
    }

    // Picnic-API abfragen
    const bestellung = await ladeAktuelleBestellung()

    if (!bestellung) {
      await supabase.from('picnic_bestellung_status').update({
        geprueft_am: new Date().toISOString(),
      }).eq('wochenplan_id', aktiverPlan.id)

      return NextResponse.json({
        status: 'offen',
        fehlende_produkte: [],
        gesendete_anzahl: (snapshot.gesendete_produkte ?? []).length,
      })
    }

    // Vergleich: welche gesendeten Produkte tauchen nicht in der Bestellung auf?
    const bestellteNamen = bestellung.artikel_namen.map(normalisiereProduktname)
    const gesendeteProdukte: string[] = snapshot.gesendete_produkte ?? []
    const fehlende = gesendeteProdukte.filter(p => {
      const norm = normalisiereProduktname(p)
      return !bestellteNamen.some(b => b.includes(norm) || norm.includes(b.split(' ')[0]))
    })

    await supabase.from('picnic_bestellung_status').update({
      bestellung_erkannt: true,
      bestellung_id: bestellung.bestellung_id,
      fehlende_produkte: fehlende,
      geprueft_am: new Date().toISOString(),
    }).eq('wochenplan_id', aktiverPlan.id)

    return NextResponse.json({
      status: 'bestellt',
      fehlende_produkte: fehlende,
      gesendete_anzahl: gesendeteProdukte.length,
      bestellt_am: bestellung.erstellt_am,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
