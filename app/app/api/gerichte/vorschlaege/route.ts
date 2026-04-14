import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sucheRezeptUrl } from '@/lib/themealdb'
import Anthropic from '@anthropic-ai/sdk'
import type { FamilieMitglied } from '@/types'

interface GericherVorschlag {
  name: string
  kategorie: string
  aufwand: string
  beschreibung: string
  rezept_url: string | null
}

interface ClaudeVorschlag {
  name: string
  kategorie: string
  aufwand: string
  beschreibung: string
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { hinweis?: string }
  const hinweis = body.hinweis ?? ''

  const [{ data: gerichteDB }, { data: profile }] = await Promise.all([
    supabase.from('gerichte').select('name'),
    supabase.from('familie_profile').select('*'),
  ])

  const bestehendeNamen = (gerichteDB ?? []).map((g: { name: string }) => g.name)
  const profileTyped = (profile ?? []) as FamilieMitglied[]

  const profilText = profileTyped.map(p =>
    `- ${p.name}: mag ${p.lieblingsgerichte.slice(0, 3).join(', ')}; mag nicht: ${p.abneigungen.join(', ')}`
  ).join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Du bist Jarvis, ein Haushaltsassistent für eine deutsche Familie mit 2 Kindern (Ben 11, Marie 8).

Schlage 3 neue Gerichte vor, die gut zur Familie passen.

Familienprofile:
${profilText}

Bereits vorhandene Gerichte (NICHT vorschlagen):
${bestehendeNamen.join(', ')}

${hinweis ? `Besonderer Wunsch: ${hinweis}` : ''}

REGELN:
- Kein Gericht aus der obigen Liste vorschlagen
- Kinder-freundlich (keine sehr scharfen oder exotischen Gerichte)
- Abwechslungsreich in den Kategorien
- Deutsche/europäische oder bekannte internationale Küche

Antworte NUR mit diesem JSON-Array, kein weiterer Text:
[
  {
    "name": "...",
    "kategorie": "fleisch|nudeln|suppe|auflauf|fisch|salat|sonstiges|kinder",
    "aufwand": "schnell|mittel|aufwendig",
    "beschreibung": "1-2 Sätze Beschreibung des Gerichts"
  }
]`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const vorschlaege = JSON.parse(text) as ClaudeVorschlag[]

  const angereichert: GericherVorschlag[] = await Promise.all(
    vorschlaege.map(async (v) => ({
      ...v,
      rezept_url: await sucheRezeptUrl(v.name),
    }))
  )

  return NextResponse.json(angereichert)
}
