import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import type { Gericht } from '@/types'

const BATCH_SIZE = 5

type RezeptGericht = { name: string; rezept: { zutaten: string[]; zubereitung: string[] } }

async function generiereRezeptBatch(
  client: Anthropic,
  gerichte: Pick<Gericht, 'id' | 'name'>[]
): Promise<RezeptGericht[]> {
  const gerichtListe = gerichte.map(g => `- ${g.name}`).join('\n')

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
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  // JSON aus Antwort extrahieren — robust gegen umschließenden Text und Code-Blöcke
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Kein JSON gefunden: ${raw.slice(0, 200)}`)

  const parsed: { gerichte: RezeptGericht[] } = JSON.parse(jsonMatch[0])
  return parsed.gerichte
}

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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const alleGerichte = gerichte as Pick<Gericht, 'id' | 'name'>[]

  // In Batches von BATCH_SIZE aufteilen
  const batches: Pick<Gericht, 'id' | 'name'>[][] = []
  for (let i = 0; i < alleGerichte.length; i += BATCH_SIZE) {
    batches.push(alleGerichte.slice(i, i + BATCH_SIZE))
  }

  let aktualisiert = 0
  const fehler: string[] = []

  for (const batch of batches) {
    try {
      const ergebnisse = await generiereRezeptBatch(client, batch)

      const updates = ergebnisse.map(async (g) => {
        const gericht = batch.find(dbG => dbG.name === g.name)
        if (!gericht) return
        await supabase.from('gerichte').update({ rezept: g.rezept }).eq('id', gericht.id)
        aktualisiert++
      })
      await Promise.all(updates)
    } catch (e: unknown) {
      fehler.push(e instanceof Error ? e.message : 'Unbekannter Fehler')
    }
  }

  if (fehler.length > 0 && aktualisiert === 0) {
    return NextResponse.json({ error: fehler[0] }, { status: 502 })
  }

  return NextResponse.json({ aktualisiert, fehler: fehler.length > 0 ? fehler : undefined })
}
