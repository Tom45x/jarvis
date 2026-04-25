import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
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

function tokensGleich(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null) as { url?: string; token?: string } | null
    if (!body?.url || !body?.token) {
      return ok200({ ok: false, error: 'url und token erforderlich' })
    }

    const expectedToken = process.env.INSTA_IMPORT_TOKEN
    if (!expectedToken || !tokensGleich(body.token, expectedToken)) {
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
    let parsed: Awaited<ReturnType<typeof parseRezeptMitClaude>>
    try {
      parsed = await parseRezeptMitClaude(scrape.caption)
    } catch (e) {
      console.error('[insta-import] Claude-Call-Fehler für', normalizedUrl, e)
      return ok200({ ok: false, error: 'Rezept konnte nicht extrahiert werden' })
    }
    if (!parsed) {
      // Caption gekürzt loggen — DSGVO + Log-Spam vermeiden
      console.error('[insta-import] Claude-Parse-Fail für', normalizedUrl, '\nCaption (gekürzt):', scrape.caption.slice(0, 500))
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
      // Race-Condition: paralleler Import desselben Reels → Unique-Constraint-Violation (Postgres 23505)
      // Statt Fehler → das parallel angelegte Gericht zurückgeben.
      const code = (insertError as { code?: string } | null)?.code
      if (code === '23505') {
        const { data: race } = await supabase
          .from('gerichte')
          .select('id, name')
          .eq('quelle_url', normalizedUrl)
          .maybeSingle()
        if (race) {
          return ok200({ ok: true, existing: true, gericht_id: race.id, gericht_name: race.name })
        }
      }
      console.error('[insta-import] Insert-Fehler:', insertError)
      return ok200({ ok: false, error: 'Speichern fehlgeschlagen' })
    }

    return ok200({
      ok: true,
      existing: false,
      gericht_id: inserted.id,
      gericht_name: inserted.name,
    })
  } catch (e) {
    // Unerwarteter Fehler (DB-Outage, Anthropic-Throw außerhalb des inner try, Netzwerk).
    // Always-200-Versprechen halten, damit der iOS-Shortcut nicht abbricht.
    console.error('[insta-import] Unerwarteter Fehler:', e)
    return ok200({ ok: false, error: 'Interner Fehler' })
  }
}
