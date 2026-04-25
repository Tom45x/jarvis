import Anthropic from '@anthropic-ai/sdk'
import { logClaudeNutzung } from '@/lib/claude-tracking'
import type { Zutat } from '@/types'

export type AufwandWert = '15 Min' | '30 Min' | '45 Min' | '60+ Min'

export interface ParsedGericht {
  name: string
  aufwand: AufwandWert
  gesund: boolean
  zutaten: Zutat[]
  rezept: {
    zutaten: string[]
    zubereitung: string[]
  }
}

const GUELTIGE_AUFWAND: AufwandWert[] = ['15 Min', '30 Min', '45 Min', '60+ Min']
const GUELTIGE_EINHEITEN = ['g', 'ml', 'Stück', 'EL', 'TL', 'Bund', 'Packung', 'kg', 'l']

const SYSTEM_PROMPT = `Du bekommst eine Instagram-Reel-Caption auf Deutsch. Extrahiere daraus ein strukturiertes Gericht für die Familienküche.

Output: AUSSCHLIESSLICH dieses JSON, kein weiterer Text:

{
  "name": "<kurzer Gericht-Name, max 50 Zeichen, ohne Emojis>",
  "aufwand": "15 Min" | "30 Min" | "45 Min" | "60+ Min",
  "gesund": true | false,
  "zutaten": [
    { "name": "<Lebensmittel>", "menge": <Zahl>, "einheit": "<...>", "haltbarkeit_tage": <Zahl> }
  ],
  "rezept": {
    "zutaten": ["<lesbare Strings, Original-Formulierung>"],
    "zubereitung": ["<Schritt 1>", "<Schritt 2>", ...]
  }
}

REGELN:

1. NAME — Aus Titel/Caption ableiten, ABER Creator-Prefixes wie
   "Kochen & Backen mit • Josef •" oder "@joeskochwelt:" weglassen.

2. STRUKTURIERTE ZUTATEN (zutaten[], speist Einkaufsliste):
   - Markennamen: Wenn du sicher weißt, was das generische Lebensmittel ist,
     ersetze es (z.B. "Maggi Würzbrühe" → "Gemüsebrühe"). Bei Unsicherheit:
     Zutat KOMPLETT WEGLASSEN aus diesem Array.
   - Mengen wie "eine Handvoll" oder "etwas" sinnvoll schätzen
     (Handvoll Bärlauch = 1 Bund, "etwas Salz" = 1 TL).
   - Einheit-Whitelist: g, ml, Stück, EL, TL, Bund, Packung, kg, l.
   - haltbarkeit_tage: Frisches Gemüse/Kräuter 3–5, Hähnchen/Fisch 2,
     Käse/Wurst 14, Eier 21, Konserven 365, Pasta/Reis 730.

3. REZEPT.ZUTATEN (lesbar, Mensch):
   - Original-Reihenfolge und -Formulierung bewahren ("2 Hähnchenbrüste").
   - Markennamen HIER bleiben drin (auch wenn aus zutaten[] entfernt).
   - Emojis (✳️ 🍗 etc.) entfernen.

4. REZEPT.ZUBEREITUNG:
   - Original-Schritte als Array. Werbung ("Anzeige- eigene Gewürze...")
     und Hashtags am Ende entfernen.

5. AUFWAND — Schätze: 4–6 simple Schritte = 15 Min, 7–10 = 30 Min,
   viel Vorbereitung/Backen = 45 Min, mehrstündig = 60+ Min.

6. GESUND — true wenn überwiegend frische Zutaten und wenig Sahne/Käse/
   Zucker/Frittiertes. Sonst false.`

export async function parseRezeptMitClaude(caption: string): Promise<ParsedGericht | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: caption }],
  })

  await logClaudeNutzung('instagram-import', 'claude-sonnet-4-6', message.usage)

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return null
  }

  const zutatenRaw = Array.isArray(parsed.zutaten) ? parsed.zutaten : []
  const rezeptRaw = (parsed.rezept ?? {}) as { zutaten?: unknown; zubereitung?: unknown }
  const rezeptZutaten = Array.isArray(rezeptRaw.zutaten) ? rezeptRaw.zutaten as string[] : []
  const rezeptZubereitung = Array.isArray(rezeptRaw.zubereitung) ? rezeptRaw.zubereitung as string[] : []

  if (zutatenRaw.length === 0 && rezeptZubereitung.length === 0) return null

  const zutaten: Zutat[] = zutatenRaw
    .filter((z: unknown): z is Zutat => {
      if (!z || typeof z !== 'object') return false
      const zz = z as Record<string, unknown>
      return typeof zz.name === 'string'
        && typeof zz.menge === 'number'
        && typeof zz.einheit === 'string'
        && GUELTIGE_EINHEITEN.includes(zz.einheit)
        && typeof zz.haltbarkeit_tage === 'number'
    })

  const aufwandWert = typeof parsed.aufwand === 'string' && GUELTIGE_AUFWAND.includes(parsed.aufwand as AufwandWert)
    ? parsed.aufwand as AufwandWert
    : '30 Min'

  return {
    name: typeof parsed.name === 'string' ? parsed.name.slice(0, 100) : 'Insta-Rezept',
    aufwand: aufwandWert,
    gesund: parsed.gesund === true,
    zutaten,
    rezept: {
      zutaten: rezeptZutaten,
      zubereitung: rezeptZubereitung,
    },
  }
}
