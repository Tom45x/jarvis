import Anthropic from '@anthropic-ai/sdk'
import { logClaudeNutzung } from '@/lib/claude-tracking'
import type { Zutat } from '@/types'
import { type AufwandWert, validiereZutaten } from '@/lib/rezept-shared'

export function aufwandAusMinuten(minutes: number | null): AufwandWert {
  if (minutes === null) return '30 Min'
  if (minutes <= 15) return '15 Min'
  if (minutes <= 30) return '30 Min'
  if (minutes <= 45) return '45 Min'
  return '60+ Min'
}

export interface ParsedZutaten {
  zutaten: Zutat[]
  gesund: boolean
}

const SYSTEM_PROMPT = `Du bekommst eine Liste von Zutaten-Strings aus einem Chefkoch-Rezept (auf Deutsch, bereits einzeln aufgelistet). Wandle sie in strukturierte Zutaten für die Einkaufsliste um und beurteile, ob das Gericht insgesamt gesund ist.

Output: AUSSCHLIESSLICH dieses JSON, kein weiterer Text:

{
  "zutaten": [
    { "name": "<Lebensmittel>", "menge": <Zahl>, "einheit": "<...>", "haltbarkeit_tage": <Zahl> }
  ],
  "gesund": true | false
}

REGELN:

1. STRUKTURIERTE ZUTATEN (zutaten[], speist Einkaufsliste):
   - Markennamen: Wenn du sicher weißt, was das generische Lebensmittel ist,
     ersetze es (z.B. "Maggi Würzbrühe" → "Gemüsebrühe"). Bei Unsicherheit:
     Zutat KOMPLETT WEGLASSEN aus diesem Array.
   - Chefkoch-typische Formulierungen wie "Ei(er), Größe M" oder
     "Scheibe/n Kastenweißbrot(e)" auf das Grundlebensmittel reduzieren.
   - "n. B." (nach Belieben) sinnvoll schätzen oder weglassen, wenn keine
     sinnvolle Menge ableitbar ist.
   - Einheit-Whitelist: g, ml, Stück, EL, TL, Bund, Packung, kg, l.
   - haltbarkeit_tage: Frisches Gemüse/Kräuter 3–5, Hähnchen/Fisch 2,
     Käse/Wurst 14, Eier 21, Konserven 365, Pasta/Reis 730.

2. GESUND — true wenn überwiegend frische Zutaten und wenig Sahne/Käse/
   Zucker/Frittiertes. Sonst false.`

export async function parseZutatenMitClaude(zutatenRoh: string[]): Promise<ParsedZutaten | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: zutatenRoh.join('\n') }],
  })

  await logClaudeNutzung('chefkoch-import', 'claude-sonnet-4-6', message.usage)

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return null
  }

  return {
    zutaten: validiereZutaten(parsed.zutaten),
    gesund: parsed.gesund === true,
  }
}
