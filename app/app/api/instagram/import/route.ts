import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { normalisiereInstaUrl, holeReelCaption } from '@/lib/instagram'
import { parseRezeptMitClaude } from '@/lib/instagram-parser'

export const maxDuration = 60

type Erfolg = { ok: true; existing: boolean; gericht_id: string; gericht_name: string }
type Misserfolg = { ok: false; error: string }
type Antwort = Erfolg | Misserfolg

function ok200(body: Antwort): NextResponse {
  // display-Feld für iOS-Mitteilung automatisch ergänzen
  const display = body.ok
    ? (body.existing ? `↻ ${body.gericht_name} (schon importiert)` : `✓ ${body.gericht_name}`)
    : `⚠️ ${body.error}`
  return NextResponse.json({ ...body, display }, { status: 200 })
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { url?: string; token?: string } | null
  if (!body?.url || !body?.token) {
    return ok200({ ok: false, error: 'url und token erforderlich' })
  }

  if (body.token !== process.env.INSTA_IMPORT_TOKEN) {
    return ok200({ ok: false, error: 'Ungültiger Token' })
  }

  let normalizedUrl: string
  try {
    normalizedUrl = normalisiereInstaUrl(body.url)
  } catch {
    return ok200({ ok: false, error: 'Keine gültige Instagram-URL' })
  }

  // Dedup-Check
  const { data: existing } = await supabase
    .from('gerichte')
    .select('id, name')
    .eq('quelle_url', normalizedUrl)
    .maybeSingle()

  if (existing) {
    return ok200({
      ok: true,
      existing: true,
      gericht_id: existing.id,
      gericht_name: existing.name,
    })
  }

  // Insta-Scrape
  const scrape = await holeReelCaption(normalizedUrl)
  if (!scrape) {
    console.error('[insta-import] Kein og:description für', normalizedUrl)
    return ok200({ ok: false, error: 'Konnte das Reel nicht öffnen — vielleicht privat oder gelöscht?' })
  }

  // Claude-Parse
  const parsed = await parseRezeptMitClaude(scrape.caption)
  if (!parsed) {
    console.error('[insta-import] Claude-Parse-Fail für', normalizedUrl, '\nCaption:', scrape.caption)
    return ok200({ ok: false, error: 'Rezept konnte nicht extrahiert werden' })
  }

  // Insert
  const { data: inserted, error: insertError } = await supabase
    .from('gerichte')
    .insert({
      name: parsed.name,
      kategorie: 'instagram',
      quelle: 'instagram',
      quelle_url: normalizedUrl,
      aufwand: parsed.aufwand,
      gesund: parsed.gesund,
      zutaten: parsed.zutaten,
      rezept: parsed.rezept,
      bewertung: 3,
      tausch_count: 0,
      gesperrt: false,
      beliebtheit: {},
    })
    .select('id, name')
    .single()

  if (insertError || !inserted) {
    console.error('[insta-import] Insert-Fehler:', insertError)
    return ok200({ ok: false, error: 'Speichern fehlgeschlagen' })
  }

  return ok200({
    ok: true,
    existing: false,
    gericht_id: inserted.id,
    gericht_name: inserted.name,
  })
}
