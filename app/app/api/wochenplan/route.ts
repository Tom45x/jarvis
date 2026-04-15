import { NextRequest, NextResponse } from 'next/server'
import { ladeAktuellenWochenplan, speichereWochenplan } from '@/lib/wochenplan'
import type { DrinkVorschlag, WochenplanEintrag } from '@/types'

export async function GET() {
  const plan = await ladeAktuellenWochenplan()
  if (!plan) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(plan)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { eintraege, status, drinks }: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt'; drinks?: DrinkVorschlag[] } = body

  if (!Array.isArray(eintraege)) {
    return NextResponse.json({ error: 'eintraege muss ein Array sein' }, { status: 400 })
  }
  if (status !== 'entwurf' && status !== 'genehmigt') {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  // Aktuelle Drinks laden falls nicht mitgeschickt (z.B. beim Tauschen)
  let aktuelleAbDrinks = drinks
  if (aktuelleAbDrinks === undefined) {
    const aktuell = await ladeAktuellenWochenplan()
    aktuelleAbDrinks = aktuell?.drinks ?? []
  }

  const plan = await speichereWochenplan(eintraege, status, aktuelleAbDrinks)
  return NextResponse.json(plan)
}
