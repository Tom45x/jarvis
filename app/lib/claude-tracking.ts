import { supabase } from '@/lib/supabase-server'

// Preise in USD pro 1 Million Tokens.
// VOR dem ersten echten Produktionseinsatz gegen aktuelle Preise prüfen:
// https://www.anthropic.com/pricing
const PREISE: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'claude-opus-4-6': { input: 15, output: 75 },
}

export async function logClaudeNutzung(
  operation: string,
  modell: string,
  usage: { input_tokens: number; output_tokens: number }
): Promise<void> {
  try {
    const preis = PREISE[modell] ?? { input: 0, output: 0 }
    const kosten_usd = (usage.input_tokens * preis.input + usage.output_tokens * preis.output) / 1_000_000
    await supabase.from('claude_nutzung').insert({
      operation,
      modell,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      kosten_usd,
    })
  } catch {
    // Logging-Fehler dürfen nie den Hauptflow unterbrechen
  }
}
