import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export const SPERR_SCHWELLE = 4

export function berechneGesperrt(neuerCount: number): boolean {
  return neuerCount >= SPERR_SCHWELLE
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: gericht, error: fetchError } = await supabase
    .from('gerichte')
    .select('tausch_count')
    .eq('id', id)
    .single()

  if (fetchError || !gericht) {
    return NextResponse.json({ error: 'Gericht nicht gefunden' }, { status: 404 })
  }

  const neuerCount = ((gericht as { tausch_count: number }).tausch_count ?? 0) + 1
  const gesperrt = berechneGesperrt(neuerCount)

  const { data, error } = await supabase
    .from('gerichte')
    .update({ tausch_count: neuerCount, gesperrt })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
