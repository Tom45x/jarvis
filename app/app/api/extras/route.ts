import { NextRequest, NextResponse } from 'next/server'
import { ladeExtrasForPlan } from '@/lib/extras'

export async function GET(req: NextRequest) {
  const wochenplanId = req.nextUrl.searchParams.get('wochenplan_id')
  if (!wochenplanId) {
    return NextResponse.json({ error: 'wochenplan_id fehlt' }, { status: 400 })
  }

  try {
    const extras = await ladeExtrasForPlan(wochenplanId)
    return NextResponse.json(extras)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
