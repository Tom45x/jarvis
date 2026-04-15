import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import type { Zutat } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null) as {
    zutaten?: Zutat[]
    bewertung?: number
    rezept?: { zutaten: string[]; zubereitung: string[] } | null
  } | null

  if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.zutaten !== undefined) updates.zutaten = body.zutaten
  if (body.bewertung !== undefined) updates.bewertung = body.bewertung
  if (body.rezept !== undefined) updates.rezept = body.rezept

  const { data, error } = await supabase
    .from('gerichte')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await supabase.from('gerichte').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
