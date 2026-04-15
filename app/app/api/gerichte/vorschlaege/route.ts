import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import type { FamilieMitglied } from '@/types'

export interface GerichtVorschlag {
  name: string
  kategorie: string
  aufwand: string
  beschreibung: string
  rezept: {
    zutaten: string[]
    zubereitung: string[]
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'KI-Funktion nicht verfügbar (kein API-Key konfiguriert)' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { hinweis?: string } | null
  const hinweis = body?.hinweis ?? ''

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

  const kinderProfil = profileTyped
    .filter(p => p.alter && p.alter < 18)
    .map(p => `${p.name} ${p.alter}`)
    .join(', ')
  const familienBeschreibung = kinderProfil
    ? `mit Kindern (${kinderProfil})`
    : ''

  const prompt = `Du bist Jarvis, Chefkoch und Haushaltsassistent für eine deutsche Familie ${familienBeschreibung}.

Schlage 3 neue Gerichte vor und liefere für jedes ein vollständiges Rezept.

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
- Mengenangaben für 4 Personen
- Zubereitung in 3-5 klaren Schritten

Antworte NUR mit diesem JSON-Array, kein weiterer Text:
[
  {
    "name": "...",
    "kategorie": "fleisch|nudeln|suppe|auflauf|fisch|salat|sonstiges|kinder|trainingstage",
    "aufwand": "15 Min|30 Min|45 Min|60+ Min",
    "beschreibung": "1-2 Sätze Beschreibung",
    "rezept": {
      "zutaten": ["200g Nudeln", "2 Eier", "..."],
      "zubereitung": ["Schritt 1: ...", "Schritt 2: ...", "..."]
    }
  }
]`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let vorschlaege: GerichtVorschlag[]
  try {
    vorschlaege = JSON.parse(text) as GerichtVorschlag[]
  } catch {
    return NextResponse.json({ error: `Ungültige JSON-Antwort von Claude: ${text.slice(0, 200)}` }, { status: 502 })
  }

  return NextResponse.json(vorschlaege)
}
