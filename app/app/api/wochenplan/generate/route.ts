import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generiereWochenplan } from '@/lib/claude'
import { erstelleWochenplanEintraege, speichereWochenplan } from '@/lib/wochenplan'
import type { FamilieMitglied, Gericht, WochenplanEintrag } from '@/types'

const WOCHENTAGE_FRUEHSTUECK = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag'] as const

export async function POST() {
  const [{ data: profile }, { data: gerichte }] = await Promise.all([
    supabase.from('familie_profile').select('*'),
    supabase.from('gerichte').select('*').eq('gesperrt', false),
  ])

  if (!profile || !gerichte) {
    return NextResponse.json({ error: 'Daten konnten nicht geladen werden' }, { status: 500 })
  }

  const toast = (gerichte as Gericht[]).find(g => g.name === 'Toast mit Aufschnitt')
  const ergebnis = await generiereWochenplan(
    profile as FamilieMitglied[],
    gerichte as Gericht[]
  )

  const claudeEintraege = erstelleWochenplanEintraege(ergebnis.mahlzeiten, gerichte as Gericht[])

  // Mo-Fr: Frühstück immer Toast mit Aufschnitt
  const fruehstueckEintraege: WochenplanEintrag[] = toast
    ? WOCHENTAGE_FRUEHSTUECK.map(tag => ({
        tag,
        mahlzeit: 'frühstück' as const,
        gericht_id: toast.id,
        gericht_name: toast.name,
      }))
    : []

  const alleEintraege = [...fruehstueckEintraege, ...claudeEintraege]
  const plan = await speichereWochenplan(alleEintraege, 'entwurf')

  return NextResponse.json({ ...plan, drinks: ergebnis.drinks })
}
