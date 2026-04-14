import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generiereEinkaufslisten } from '@/lib/einkaufsliste'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { ladeAktuellenWochenplan } from '@/lib/wochenplan'
import type { Gericht } from '@/types'

export async function POST() {
  const plan = await ladeAktuellenWochenplan()
  if (!plan) {
    return NextResponse.json(
      { error: 'Kein Wochenplan für diese Woche gefunden' },
      { status: 404 }
    )
  }

  const { data: gerichte, error } = await supabase
    .from('gerichte')
    .select('*')
  if (error || !gerichte) {
    return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
  }

  const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)

  const { einkauf1, einkauf2 } = generiereEinkaufslisten(
    plan.eintraege,
    gerichte as Gericht[],
    einkaufstag2
  )

  const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
  const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'

  await Promise.all([
    aktualisiereEinkaufsliste(listName1, einkauf1),
    aktualisiereEinkaufsliste(listName2, einkauf2),
  ])

  return NextResponse.json({
    einkauf1Count: einkauf1.length,
    einkauf2Count: einkauf2.length,
  })
}
