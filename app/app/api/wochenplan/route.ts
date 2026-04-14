import { NextRequest, NextResponse } from 'next/server'
import { ladeAktuellenWochenplan, speichereWochenplan } from '@/lib/wochenplan'
import type { WochenplanEintrag } from '@/types'

export async function GET() {
  const plan = await ladeAktuellenWochenplan()
  if (!plan) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(plan)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { eintraege, status }: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' } = body
  const plan = await speichereWochenplan(eintraege, status)
  return NextResponse.json(plan)
}
