import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { generiereWochenplan } from '@/lib/claude'
import { erstelleWochenplanEintraege, speichereWochenplan } from '@/lib/wochenplan'
import type { FamilieMitglied, Gericht, WochenplanEintrag } from '@/types'

// Einfacher In-Memory-Lock gegen parallele Generierungsanfragen (z.B. Doppelklick)
let isGenerating = false

const WOCHENTAGE_FRUEHSTUECK = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag'] as const
const TRAININGSTAGE = ['montag', 'dienstag', 'donnerstag'] as const

function zufaellig<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function zufaelligOhneWiederholung<T>(arr: T[], anzahl: number): T[] {
  const gemischt = [...arr].sort(() => Math.random() - 0.5)
  return gemischt.slice(0, Math.min(anzahl, gemischt.length))
}

export async function POST() {
  if (isGenerating) {
    return NextResponse.json({ error: 'Plan wird bereits generiert, bitte warten.' }, { status: 429 })
  }
  isGenerating = true
  try {
  const [{ data: profile }, { data: gerichte }] = await Promise.all([
    supabase.from('familie_profile').select('*'),
    supabase.from('gerichte').select('*').eq('gesperrt', false),
  ])

  if (!profile || !gerichte) {
    return NextResponse.json({ error: 'Daten konnten nicht geladen werden' }, { status: 500 })
  }

  const alleGerichte = gerichte as Gericht[]
  const toast = alleGerichte.find(g => g.name === 'Toast mit Aufschnitt')
  const trainingsGerichte = alleGerichte.filter(g => g.kategorie === 'trainingstage')
  const fruehstueckGerichte = alleGerichte.filter(g => g.kategorie === 'frühstück' && g.name !== 'Toast mit Aufschnitt')
  const filmabendGerichte = alleGerichte.filter(g => g.kategorie === 'filmabend')

  const ergebnis = await generiereWochenplan(profile as FamilieMitglied[], alleGerichte)
  const claudeEintraege = erstelleWochenplanEintraege(ergebnis.mahlzeiten, alleGerichte)

  // Mo–Fr: Frühstück = Toast mit Aufschnitt
  const fruehstueckMoFr: WochenplanEintrag[] = toast
    ? WOCHENTAGE_FRUEHSTUECK.map(tag => ({
        tag,
        mahlzeit: 'frühstück' as const,
        gericht_id: toast.id,
        gericht_name: toast.name,
      }))
    : []

  // Mo/Di/Do Abend: Trainingstage-Gerichte (keine Wiederholung)
  const trainingsEintraege: WochenplanEintrag[] = trainingsGerichte.length > 0
    ? zufaelligOhneWiederholung(trainingsGerichte, TRAININGSTAGE.length).map((g, i) => ({
        tag: TRAININGSTAGE[i],
        mahlzeit: 'abend' as const,
        gericht_id: g.id,
        gericht_name: g.name,
      }))
    : []

  // Sa + So Frühstück: aus Frühstücks-Kategorie (keine Wiederholung)
  const wochenendFruehstueck: WochenplanEintrag[] = fruehstueckGerichte.length > 0
    ? zufaelligOhneWiederholung(fruehstueckGerichte, 2).map((g, i) => ({
        tag: i === 0 ? 'samstag' : 'sonntag',
        mahlzeit: 'frühstück' as const,
        gericht_id: g.id,
        gericht_name: g.name,
      }))
    : []

  // Freitagabend: Filmabend-Gericht (zufällig)
  const filmabendGericht = filmabendGerichte.length > 0 ? zufaellig(filmabendGerichte) : null
  const filmabendEintrag: WochenplanEintrag[] = filmabendGericht
    ? [{
        tag: 'freitag',
        mahlzeit: 'abend' as const,
        gericht_id: filmabendGericht.id,
        gericht_name: filmabendGericht.name,
      }]
    : []

  // Alle zusammenführen — programmatische Einträge haben Vorrang
  const alleEintraege = [
    ...fruehstueckMoFr,
    ...trainingsEintraege,
    ...wochenendFruehstueck,
    ...filmabendEintrag,
    ...claudeEintraege,
  ]

  const plan = await speichereWochenplan(alleEintraege, 'entwurf')
  return NextResponse.json(plan)
  } finally {
    isGenerating = false
  }
}
