import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generiereWochenplan } from '@/lib/claude'
import { erstelleWochenplanEintraege, speichereWochenplan } from '@/lib/wochenplan'
import type { FamilieMitglied, Gericht } from '@/types'

export async function POST() {
  const [{ data: profile }, { data: gerichte }] = await Promise.all([
    supabase.from('familie_profile').select('*'),
    supabase.from('gerichte').select('*').eq('gesperrt', false),
  ])

  if (!profile || !gerichte) {
    return NextResponse.json({ error: 'Daten konnten nicht geladen werden' }, { status: 500 })
  }

  const ergebnis = await generiereWochenplan(
    profile as FamilieMitglied[],
    gerichte as Gericht[]
  )

  const eintraege = erstelleWochenplanEintraege(ergebnis.mahlzeiten, gerichte as Gericht[])
  const plan = await speichereWochenplan(eintraege, 'entwurf')

  return NextResponse.json({ ...plan, drinks: ergebnis.drinks })
}
