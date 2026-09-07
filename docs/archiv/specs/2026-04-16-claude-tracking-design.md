# Claude API Tracking — Design

**Goal:** Jeden Claude API-Call automatisch protokollieren (Tokens, Kosten, Operation) — auswertbar im Supabase-Dashboard, kein Frontend nötig.

**Architecture:** Neue Supabase-Tabelle `claude_nutzung`. Neue Hilfsfunktion `lib/claude-tracking.ts` mit einem einzigen Export `logClaudeNutzung()`. Wird nach jedem `client.messages.create()` in allen 4 betroffenen Stellen aufgerufen. Fehler beim Logging werden still geschluckt — Logging darf nie einen echten API-Call zum Absturz bringen.

**Tech Stack:** Supabase (direkte Tabellen-Insert via service role key), Anthropic SDK `message.usage` Response.

---

## Tabelle `claude_nutzung`

```sql
CREATE TABLE claude_nutzung (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erstellt_am  timestamptz NOT NULL DEFAULT now(),
  operation    text NOT NULL,        -- 'wochenplan' | 'zutaten' | 'rezept' | 'vorschlaege'
  modell       text NOT NULL,        -- z.B. 'claude-sonnet-4-6'
  input_tokens  int4 NOT NULL,
  output_tokens int4 NOT NULL,
  kosten_usd   numeric(10,6) NOT NULL
);
```

Kein RLS nötig — Zugriff nur über service role key (serverseitig).

---

## Kostenberechnung

Modell `claude-sonnet-4-6`:
- Input: $3.00 / 1M Tokens → `input_tokens * 0.000003`
- Output: $15.00 / 1M Tokens → `output_tokens * 0.000015`

Formel: `kosten_usd = (input_tokens * 3 + output_tokens * 15) / 1_000_000`

Andere Modelle werden mit `0` gespeichert (Preis unbekannt) — kein Absturz.

---

## `lib/claude-tracking.ts`

```ts
import { supabase } from '@/lib/supabase-server'

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
```

---

## Betroffene Stellen (4 Calls)

| Datei | Operation |
|---|---|
| `lib/claude.ts` — `generiereWochenplan()` | `'wochenplan'` |
| `app/api/zutaten/generieren/route.ts` | `'zutaten'` |
| `app/api/rezepte/generieren/route.ts` — `generiereRezeptBatch()` | `'rezept'` |
| `app/api/gerichte/vorschlaege/route.ts` | `'vorschlaege'` |

Nach jedem `client.messages.create()`:
```ts
await logClaudeNutzung('operation', 'claude-sonnet-4-6', message.usage)
```

---

## Auswertung im Supabase-Dashboard

```sql
-- Kosten pro Operation
SELECT operation, COUNT(*) as aufrufe,
       SUM(input_tokens) as total_input,
       SUM(output_tokens) as total_output,
       ROUND(SUM(kosten_usd)::numeric, 4) as gesamt_usd
FROM claude_nutzung
GROUP BY operation
ORDER BY gesamt_usd DESC;

-- Letzten 7 Tage
SELECT DATE(erstellt_am) as tag, operation, ROUND(SUM(kosten_usd)::numeric, 4) as usd
FROM claude_nutzung
WHERE erstellt_am > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

---

## Nicht im Scope

- Frontend-Anzeige in der App
- Alerts bei Überschreitung eines Budgets
- Tracking von DEV_MODE-Mock-Calls (macht keinen Sinn — kein echter API-Call)
