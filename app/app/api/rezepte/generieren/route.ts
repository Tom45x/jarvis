import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import type { Gericht } from '@/types'

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'KI nicht konfiguriert' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const { gerichtId } = body as { gerichtId?: string }

  let query = supabase.from('gerichte').select('id, name')
  if (gerichtId) {
    query = query.eq('id', gerichtId)
  } else {
    query = query.is('rezept', null)
  }

  const { data: gerichte, error } = await query.order('name')
  if (error || !gerichte || gerichte.length === 0) {
    return NextResponse.json({ aktualisiert: 0 })
  }

  const gerichtListe = (gerichte as Pick<Gericht, 'id' | 'name'>[])
    .map(g => `- ${g.name}`)
    .join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Erstelle für jedes der folgenden Gerichte ein vollständiges Rezept für 4 Personen (2 Erwachsene, 2 Kinder 8–11 Jahre).

Für jedes Gericht:
- zutaten: 4–8 lesbare Zutat-Strings (z.B. "200g Spaghetti", "2 Knoblauchzehen", "1 Dose Tomaten")
- zubereitung: 4–6 klare Zubereitungsschritte auf Deutsch

Gerichte:
${gerichtListe}

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "gerichte": [
    {
      "name": "...",
      "rezept": {
        "zutaten": ["...", "..."],
        "zubereitung": ["Schritt 1: ...", "Schritt 2: ..."]
      }
    }
  ]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let parsed: { gerichte: Array<{ name: string; rezept: { zutaten: string[]; zubereitung: string[] } }> }
  try {
    parsed = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: `Ungültige JSON-Antwort von Claude: ${text.slice(0, 200)}` }, { status: 502 })
  }

  const updates = parsed.gerichte.map(async (g) => {
    const gericht = (gerichte as Pick<Gericht, 'id' | 'name'>[]).find(dbG => dbG.name === g.name)
    if (!gericht) return
    return supabase
      .from('gerichte')
      .update({ rezept: g.rezept })
      .eq('id', gericht.id)
  })

  await Promise.all(updates)

  return NextResponse.json({ aktualisiert: parsed.gerichte.length })
}
