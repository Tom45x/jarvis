import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabase
    .from('regelbedarf')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name: string; menge: number; einheit: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
  }
  if (typeof body.menge !== 'number' || isNaN(body.menge) || body.menge <= 0) {
    return NextResponse.json({ error: 'Menge muss eine positive Zahl sein' }, { status: 400 })
  }
  if (!body.einheit?.trim()) {
    return NextResponse.json({ error: 'Einheit ist erforderlich' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('regelbedarf')
    .insert({ name: body.name, menge: body.menge, einheit: body.einheit })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
