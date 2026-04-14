import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import type { Gericht, Zutat } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { gerichtId } = body as { gerichtId?: string }

  let query = supabase.from('gerichte').select('id, name')
  if (gerichtId) {
    query = query.eq('id', gerichtId)
  }

  const { data: gerichte, error } = await query.order('name')
  if (error || !gerichte) {
    return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
  }

  const gerichtListe = (gerichte as Pick<Gericht, 'id' | 'name'>[])
    .map(g => `- ${g.name}`)
    .join('\n')

  const prompt = `Erstelle für jedes der folgenden Gerichte eine strukturierte Zutatenliste.
Basis: 4 Personen (2 Erwachsene, 2 Kinder zwischen 8-11 Jahren), 1 Mahlzeit.

Für jede Zutat:
- name: Zutat-Name auf Deutsch
- menge: Zahl (kein Text)
- einheit: einer von: "g", "kg", "ml", "l", "Stück", "EL", "TL", "Bund", "Packung"
- haltbarkeit_tage: wie viele Tage hält die Zutat im Kühlschrank (z.B. Hackfleisch=2, Nudeln=365, Milch=7, Zwiebeln=14, Karotten=10)

Gerichte:
${gerichtListe}

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "gerichte": [
    {
      "name": "...",
      "zutaten": [
        { "name": "...", "menge": 0, "einheit": "...", "haltbarkeit_tage": 0 }
      ]
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
  const parsed = JSON.parse(text) as { gerichte: Array<{ name: string; zutaten: Zutat[] }> }

  const updates = parsed.gerichte.map(async (g) => {
    const gericht = (gerichte as Pick<Gericht, 'id' | 'name'>[]).find(dbG => dbG.name === g.name)
    if (!gericht) return
    return supabase
      .from('gerichte')
      .update({ zutaten: g.zutaten })
      .eq('id', gericht.id)
  })

  await Promise.all(updates)

  return NextResponse.json({ aktualisiert: parsed.gerichte.length })
}
