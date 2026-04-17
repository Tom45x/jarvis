import { NextRequest, NextResponse } from 'next/server'
import {
  ladeExtrasForPlan, ladeExtrasKatalog, ladeKinderProfile,
  ladeExtrasHistory, berechneGapVektor, generiereExtras, speichereExtras
} from '@/lib/extras'

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

export async function POST(req: NextRequest) {
  const { wochenplan_id } = await req.json()
  if (!wochenplan_id) {
    return NextResponse.json({ error: 'wochenplan_id fehlt' }, { status: 400 })
  }

  try {
    const [katalog, kinderProfile, history] = await Promise.all([
      ladeExtrasKatalog(),
      ladeKinderProfile(),
      ladeExtrasHistory(4),
    ])
    const gapVektor = berechneGapVektor(history, kinderProfile)
    const ergebnis = await generiereExtras(katalog, gapVektor, history, kinderProfile)

    const gespeichert = await speichereExtras(wochenplan_id, [
      { wochenplan_id, katalog_id: ergebnis.snack_dienstag.katalog_id, typ: 'snack', tag: 'dienstag', name: ergebnis.snack_dienstag.name, begruendung: ergebnis.snack_dienstag.begruendung, naehrstoffe_snapshot: ergebnis.snack_dienstag.naehrstoffe, ist_neu: ergebnis.snack_dienstag.ist_neu },
      { wochenplan_id, katalog_id: ergebnis.snack_donnerstag.katalog_id, typ: 'snack', tag: 'donnerstag', name: ergebnis.snack_donnerstag.name, begruendung: ergebnis.snack_donnerstag.begruendung, naehrstoffe_snapshot: ergebnis.snack_donnerstag.naehrstoffe, ist_neu: ergebnis.snack_donnerstag.ist_neu },
      { wochenplan_id, katalog_id: ergebnis.saft_samstag.katalog_id, typ: 'saft', tag: 'samstag', name: ergebnis.saft_samstag.name, begruendung: ergebnis.saft_samstag.begruendung, naehrstoffe_snapshot: ergebnis.saft_samstag.naehrstoffe, ist_neu: ergebnis.saft_samstag.ist_neu },
    ])

    return NextResponse.json(gespeichert)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
