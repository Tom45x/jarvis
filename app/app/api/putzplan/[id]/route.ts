import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { periodeFuer } from '@/lib/putzplan'
import type { PutzRhythmus } from '@/types'

type Kontext = { params: Promise<{ id: string }> }

// Liefert den aktuellen Periodenschlüssel der Aufgabe, oder null wenn es sie nicht gibt
async function aktuellePeriode(id: string): Promise<string | null> {
  const { data, error } = await supabase.from('putz_aufgaben').select('rhythmus').eq('id', id).single()
  if (error || !data) return null
  return periodeFuer(data.rhythmus as PutzRhythmus)
}

export async function POST(_request: NextRequest, { params }: Kontext) {
  const { id } = await params
  const periode = await aktuellePeriode(id)
  if (!periode) return NextResponse.json({ error: 'Aufgabe nicht gefunden' }, { status: 404 })

  const { data, error } = await supabase
    .from('putz_erledigungen')
    .upsert({ aufgabe_id: id, periode }, { onConflict: 'aufgabe_id,periode' })
    .select('erledigt_am')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ erledigt_am: data.erledigt_am })
}

export async function DELETE(_request: NextRequest, { params }: Kontext) {
  const { id } = await params
  const periode = await aktuellePeriode(id)
  if (!periode) return NextResponse.json({ error: 'Aufgabe nicht gefunden' }, { status: 404 })

  const { error } = await supabase
    .from('putz_erledigungen')
    .delete()
    .eq('aufgabe_id', id)
    .eq('periode', periode)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
