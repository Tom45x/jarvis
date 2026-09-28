import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { berlinDatum, periodenSchluessel } from '@/lib/putzplan'
import type { PutzAufgabe, Putzplan } from '@/types'

export async function GET() {
  const jetzt = new Date()
  const perioden = periodenSchluessel(jetzt)

  const [aufgabenRes, erledigtRes] = await Promise.all([
    supabase.from('putz_aufgaben').select('id, titel, beschreibung, rhythmus, wochentag, sortierung').order('sortierung'),
    supabase
      .from('putz_erledigungen')
      .select('aufgabe_id, periode, erledigt_am')
      .in('periode', Object.values(perioden)),
  ])

  const error = aufgabenRes.error ?? erledigtRes.error
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Eine Erledigung zählt nur, wenn sie zur aktuellen Periode des Rhythmus gehört
  const erledigtAm = new Map<string, string>()
  for (const e of erledigtRes.data ?? []) {
    erledigtAm.set(`${e.aufgabe_id}|${e.periode}`, e.erledigt_am)
  }

  const aufgaben: PutzAufgabe[] = (aufgabenRes.data ?? []).map(a => {
    const am = erledigtAm.get(`${a.id}|${perioden[a.rhythmus as keyof typeof perioden]}`) ?? null
    return { ...a, erledigt: am !== null, erledigt_am: am }
  })

  const result: Putzplan = { aufgaben, heute: berlinDatum(jetzt).wochentag, quartal: perioden.quartal }
  return NextResponse.json(result)
}
