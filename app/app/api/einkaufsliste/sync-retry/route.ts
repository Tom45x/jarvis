import { NextRequest, NextResponse } from 'next/server'
import { ladeListe, setzeSyncFehler, aktualisiereSnapshotTeilweise } from '@/lib/einkaufsliste-persistence'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { warenkorbLeeren, zumWarenkorb } from '@/lib/picnic'
import type { EinkaufslisteSnapshot } from '@/types'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.wochenplan_id !== 'string') {
    return NextResponse.json({ error: 'wochenplan_id fehlt' }, { status: 400 })
  }

  try {
    const liste = await ladeListe(body.wochenplan_id)
    if (!liste || !liste.sync_fehler) {
      return NextResponse.json({ retried: false })
    }

    const sektion = liste.sync_fehler.sektion
    const snapshot = liste.gesendet_snapshot as EinkaufslisteSnapshot | null
    if (!snapshot) {
      await setzeSyncFehler(liste.wochenplan_id, null)
      return NextResponse.json({ retried: false })
    }

    if (sektion === 'bring1') {
      const name = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
      await aktualisiereEinkaufsliste(name, liste.bring1)
      await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, { bring1: liste.bring1 })
    } else if (sektion === 'bring2') {
      const name = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'
      await aktualisiereEinkaufsliste(name, liste.bring2)
      await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, { bring2: liste.bring2 })
    } else if (sektion === 'picnic') {
      await warenkorbLeeren()
      for (const p of liste.picnic) {
        await zumWarenkorb(p.artikelId, 1)
      }
      await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, { picnic: liste.picnic })
    }

    await setzeSyncFehler(liste.wochenplan_id, null)
    return NextResponse.json({ retried: true, sektion })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
