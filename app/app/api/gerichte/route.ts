import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabase
    .from('gerichte')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const GUELTIGE_KATEGORIEN = [
  'fleisch', 'nudeln', 'suppe', 'auflauf', 'fisch', 'salat',
  'sonstiges', 'kinder', 'trainingstage', 'frühstück', 'filmabend',
] as const

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    name: string
    kategorie: string
    aufwand: string
    gesund?: boolean
    quelle?: string
  } | null

  if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
  }
  if (!GUELTIGE_KATEGORIEN.includes(body.kategorie as typeof GUELTIGE_KATEGORIEN[number])) {
    return NextResponse.json({ error: 'Ungültige Kategorie' }, { status: 400 })
  }
  if (!body.aufwand?.trim()) {
    return NextResponse.json({ error: 'Aufwand ist erforderlich' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('gerichte')
    .insert({
      name: body.name,
      kategorie: body.kategorie,
      aufwand: body.aufwand,
      gesund: body.gesund ?? false,
      quelle: body.quelle ?? 'themealdb',
      zutaten: [],
      beliebtheit: {},
      tausch_count: 0,
      gesperrt: false,
      bewertung: 3,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
