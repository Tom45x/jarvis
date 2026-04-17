import { NextResponse } from 'next/server'
import { ladeExtrasKatalog } from '@/lib/extras'

export async function GET() {
  try {
    const katalog = await ladeExtrasKatalog()
    return NextResponse.json(katalog)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
