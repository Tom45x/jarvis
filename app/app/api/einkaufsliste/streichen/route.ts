import { NextRequest, NextResponse } from 'next/server'
import { ladeListe, setzeGestrichen } from '@/lib/einkaufsliste-persistence'

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (
    !body ||
    typeof body.wochenplan_id !== 'string' ||
    typeof body.zutatName !== 'string' ||
    typeof body.streichen !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'Request braucht wochenplan_id (string), zutatName (string) und streichen (boolean)' },
      { status: 400 }
    )
  }

  try {
    const liste = await ladeListe(body.wochenplan_id)
    if (!liste) {
      return NextResponse.json({ error: 'Liste nicht gefunden' }, { status: 404 })
    }
    if (liste.gesendet_am !== null) {
      return NextResponse.json(
        { error: 'Liste wurde bereits gesendet — Streichen nicht mehr möglich' },
        { status: 409 }
      )
    }

    const aktuell = new Set(liste.gestrichen)
    const name = body.zutatName
    if (body.streichen) aktuell.add(name)
    else aktuell.delete(name)

    await setzeGestrichen(body.wochenplan_id, [...aktuell])
    return NextResponse.json({ gestrichen: [...aktuell] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
