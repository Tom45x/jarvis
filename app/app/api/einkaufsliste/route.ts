import { NextRequest, NextResponse } from 'next/server'
import { ladeListe } from '@/lib/einkaufsliste-persistence'

export async function GET(req: NextRequest) {
  const wochenplanId = req.nextUrl.searchParams.get('wochenplan_id')
  if (!wochenplanId) {
    return NextResponse.json({ error: 'wochenplan_id fehlt' }, { status: 400 })
  }

  try {
    const liste = await ladeListe(wochenplanId)
    return NextResponse.json(liste)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
