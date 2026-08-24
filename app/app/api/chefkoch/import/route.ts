import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabase } from '@/lib/supabase-server'
import { normalisiereChefkochUrl, holeChefkochRezept } from '@/lib/chefkoch'
import { aufwandAusMinuten, parseZutatenMitClaude } from '@/lib/chefkoch-parser'

export const maxDuration = 60

type Erfolg = { ok: true; existing: boolean; gericht_id: string; gericht_name: string }
type Misserfolg = { ok: false; error: string }
type Antwort = Erfolg | Misserfolg

function ok200(body: Antwort): NextResponse {
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

    const expectedToken = process.env.CHEFKOCH_IMPORT_TOKEN
    if (!expectedToken || !tokensGleich(body.token, expectedToken)) {
      return ok200({ ok: false, error: 'Ungültiger Token' })
    }

    let normalizedUrl: string
    try {
      normalizedUrl = normalisiereChefkochUrl(body.url)
    } catch {
      return ok200({ ok: false, error: 'Keine gültige Chefkoch-Rezept-URL' })
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

    // Chefkoch-Scrape
    const rezept = await holeChefkochRezept(normalizedUrl)
    if (!rezept) {
      console.error('[chefkoch-import] Kein Recipe-JSON-LD für', normalizedUrl)
      return ok200({ ok: false, error: 'Rezept konnte nicht geladen werden — vielleicht falscher Link?' })
    }

    // Claude-Parse (nur Zutaten-Normalisierung + gesund)
    let parsed: Awaited<ReturnType<typeof parseZutatenMitClaude>>
    try {
      parsed = await parseZutatenMitClaude(rezept.zutatenRoh)
    } catch (e) {
      console.error('[chefkoch-import] Claude-Call-Fehler für', normalizedUrl, e)
      return ok200({ ok: false, error: 'Zutaten konnten nicht extrahiert werden' })
    }
    if (!parsed) {
      console.error('[chefkoch-import] Claude-Parse-Fail für', normalizedUrl)
      return ok200({ ok: false, error: 'Zutaten konnten nicht extrahiert werden' })
    }

    // Insert
    const { data: inserted, error: insertError } = await supabase
      .from('gerichte')
      .insert({
        name: rezept.name,
        kategorie: 'airfryer',
        quelle: 'chefkoch',
        quelle_url: normalizedUrl,
        aufwand: aufwandAusMinuten(rezept.totalMinutes),
        gesund: parsed.gesund,
        zutaten: parsed.zutaten,
        rezept: {
          zutaten: rezept.zutatenRoh,
          zubereitung: rezept.zubereitung,
        },
        bewertung: 3,
        tausch_count: 0,
        gesperrt: false,
        beliebtheit: {},
      })
      .select('id, name')
      .single()

    if (insertError || !inserted) {
      // Race-Condition: paralleler Import desselben Rezepts → Unique-Constraint-Violation (Postgres 23505)
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
      console.error('[chefkoch-import] Insert-Fehler:', insertError)
      return ok200({ ok: false, error: 'Speichern fehlgeschlagen' })
    }

    return ok200({
      ok: true,
      existing: false,
      gericht_id: inserted.id,
      gericht_name: inserted.name,
    })
  } catch (e) {
    console.error('[chefkoch-import] Unerwarteter Fehler:', e)
    return ok200({ ok: false, error: 'Interner Fehler' })
  }
}
