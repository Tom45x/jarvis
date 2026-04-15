import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await supabase
    .from('einstellungen')
    .select('key, value')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    result[row.key] = row.value
  }
  return NextResponse.json(result)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, string> | null
  if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })

  const upserts = Object.entries(body).map(([key, value]) => ({ key, value }))

  const { error } = await supabase
    .from('einstellungen')
    .upsert(upserts, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
