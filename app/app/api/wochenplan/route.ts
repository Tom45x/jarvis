import { NextRequest, NextResponse } from 'next/server'
import { ladeWochenAnsicht, speichereWochenplan } from '@/lib/wochenplan'
import type { WochenplanEintrag } from '@/types'

export async function GET() {
  const ansicht = await ladeWochenAnsicht()
  return NextResponse.json(ansicht)
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })

  const { eintraege, status }: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' } = body

  if (!Array.isArray(eintraege)) {
    return NextResponse.json({ error: 'eintraege muss ein Array sein' }, { status: 400 })
  }
  if (status !== 'entwurf' && status !== 'genehmigt') {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  try {
    const plan = await speichereWochenplan(eintraege, status)
    return NextResponse.json(plan)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
