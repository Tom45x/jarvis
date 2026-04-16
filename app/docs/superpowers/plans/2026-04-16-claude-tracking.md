# Claude API Tracking — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeden Claude API-Call automatisch in einer Supabase-Tabelle `claude_nutzung` protokollieren (Operation, Modell, Tokens, Kosten in USD).

**Architecture:** Neue Hilfsfunktion `lib/claude-tracking.ts` mit `logClaudeNutzung()`. Wird nach jedem `client.messages.create()` in 4 Dateien aufgerufen. Fehler beim Logging werden still geschluckt. Supabase-Tabelle wird per `pg` direkt erstellt (DATABASE_URL aus Coolify-Env).

**Tech Stack:** Next.js App Router, Supabase (supabase-js), `pg` für Migration, Jest für Tests.

---

## Dateistruktur

| Datei | Aktion |
|---|---|
| `lib/claude-tracking.ts` | Neu — `logClaudeNutzung()` Helper |
| `__tests__/lib/claude-tracking.test.ts` | Neu — Tests für Helper |
| `lib/claude.ts` | Modify — Tracking nach wochenplan-Call |
| `app/api/zutaten/generieren/route.ts` | Modify — Tracking nach zutaten-Call |
| `app/api/rezepte/generieren/route.ts` | Modify — Tracking in `generiereRezeptBatch()` |
| `app/api/gerichte/vorschlaege/route.ts` | Modify — Tracking nach vorschlaege-Call |
| `scripts/migrate-claude-nutzung.ts` | Neu — einmalige Migration (danach löschen) |

---

## Task 1: Supabase-Tabelle anlegen

**Files:**
- Create: `scripts/migrate-claude-nutzung.ts`

Kontext: DATABASE_URL muss aus der Coolify-Umgebung geholt werden. Die Coolify-API liefert Env-Vars über `GET /api/v1/applications/{uuid}/envs`. Token und UUID sind aus dem Deployment-Memory bekannt:
- API-Token: `1|ifb2KsFvEc2olgSEuYYhDHltgnXgEPsYZnJgVkYk02033322`
- App-UUID: `shpiw0907aj8qielobtzhxt8`
- Coolify-Host: `http://140.82.38.192:8000`

- [ ] **Step 1: DATABASE_URL aus Coolify laden**

```bash
curl -s -H "Authorization: Bearer 1|ifb2KsFvEc2olgSEuYYhDHltgnXgEPsYZnJgVkYk02033322" \
  "http://140.82.38.192:8000/api/v1/applications/shpiw0907aj8qielobtzhxt8/envs" \
  | grep -o '"DATABASE_URL[^}]*'
```

Notiere den DATABASE_URL-Wert.

- [ ] **Step 2: Migrationsskript erstellen**

Erstelle `scripts/migrate-claude-nutzung.ts`:

```ts
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL fehlt')

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()
  await client.query(`
    CREATE TABLE IF NOT EXISTS claude_nutzung (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      erstellt_am   timestamptz NOT NULL DEFAULT now(),
      operation     text NOT NULL,
      modell        text NOT NULL,
      input_tokens  int4 NOT NULL,
      output_tokens int4 NOT NULL,
      kosten_usd    numeric(10,6) NOT NULL
    )
  `)
  console.log('✅ Tabelle claude_nutzung erstellt (oder bereits vorhanden)')
  await client.end()
}

run().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Migrationsskript ausführen**

```bash
DATABASE_URL="<wert-aus-step-1>" npx tsx scripts/migrate-claude-nutzung.ts
```

Erwartet: `✅ Tabelle claude_nutzung erstellt (oder bereits vorhanden)`

- [ ] **Step 4: Skript wieder löschen + committen**

```bash
rm scripts/migrate-claude-nutzung.ts
git add -A
git commit -m "feat: Supabase-Tabelle claude_nutzung anlegen"
```

---

## Task 2: `logClaudeNutzung()` Helper mit Tests

**Files:**
- Create: `lib/claude-tracking.ts`
- Create: `__tests__/lib/claude-tracking.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

Erstelle `__tests__/lib/claude-tracking.test.ts`:

```ts
import { logClaudeNutzung } from '@/lib/claude-tracking'

// Supabase-Insert mocken
const mockInsert = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: jest.fn(() => ({ insert: mockInsert })),
  },
}))

describe('logClaudeNutzung', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('schreibt korrekten Datensatz für claude-sonnet-4-6', async () => {
    await logClaudeNutzung('wochenplan', 'claude-sonnet-4-6', { input_tokens: 1000, output_tokens: 500 })

    expect(mockInsert).toHaveBeenCalledWith({
      operation: 'wochenplan',
      modell: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      kosten_usd: (1000 * 3 + 500 * 15) / 1_000_000, // 0.010500
    })
  })

  it('berechnet Kosten für unbekanntes Modell als 0', async () => {
    await logClaudeNutzung('zutaten', 'claude-unbekannt-99', { input_tokens: 100, output_tokens: 100 })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ kosten_usd: 0 })
    )
  })

  it('schluckt Fehler beim Supabase-Insert still', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB down'))

    // Darf keinen Fehler werfen
    await expect(
      logClaudeNutzung('rezept', 'claude-sonnet-4-6', { input_tokens: 100, output_tokens: 100 })
    ).resolves.toBeUndefined()
  })

  it('schluckt Fehler wenn supabase.from wirft', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase-server')
    ;(supabase.from as jest.Mock).mockImplementationOnce(() => { throw new Error('Verbindung verloren') })

    await expect(
      logClaudeNutzung('vorschlaege', 'claude-sonnet-4-6', { input_tokens: 50, output_tokens: 50 })
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen FAIL sein**

```bash
npx jest __tests__/lib/claude-tracking.test.ts --no-coverage
```

Erwartet: FAIL mit `Cannot find module '@/lib/claude-tracking'`

- [ ] **Step 3: Implementation schreiben**

Erstelle `lib/claude-tracking.ts`:

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

- [ ] **Step 4: Tests ausführen — müssen PASS sein**

```bash
npx jest __tests__/lib/claude-tracking.test.ts --no-coverage
```

Erwartet: 4/4 PASS

- [ ] **Step 5: Committen**

```bash
git add lib/claude-tracking.ts __tests__/lib/claude-tracking.test.ts
git commit -m "feat: logClaudeNutzung Helper mit Tests"
```

---

## Task 3: Tracking in alle 4 Claude-Calls integrieren

**Files:**
- Modify: `lib/claude.ts`
- Modify: `app/api/zutaten/generieren/route.ts`
- Modify: `app/api/rezepte/generieren/route.ts`
- Modify: `app/api/gerichte/vorschlaege/route.ts`

### `lib/claude.ts` — Operation `'wochenplan'`

- [ ] **Step 1: Import hinzufügen**

Direkt nach dem bestehenden `import Anthropic from '@anthropic-ai/sdk'`:

```ts
import { logClaudeNutzung } from '@/lib/claude-tracking'
```

- [ ] **Step 2: Tracking nach dem messages.create-Call einfügen**

Suche die Stelle in `generiereWochenplan()`:
```ts
const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }],
})
```

Direkt danach einfügen:
```ts
await logClaudeNutzung('wochenplan', 'claude-sonnet-4-6', message.usage)
```

### `app/api/zutaten/generieren/route.ts` — Operation `'zutaten'`

- [ ] **Step 3: Import + Tracking hinzufügen**

Import am Anfang der Datei ergänzen:
```ts
import { logClaudeNutzung } from '@/lib/claude-tracking'
```

Nach dem `client.messages.create(...)` Call:
```ts
const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 8192,
  messages: [{ role: 'user', content: prompt }],
})

await logClaudeNutzung('zutaten', 'claude-sonnet-4-6', message.usage)
```

### `app/api/rezepte/generieren/route.ts` — Operation `'rezept'`

- [ ] **Step 4: Import + Tracking in `generiereRezeptBatch()` hinzufügen**

Import am Anfang der Datei ergänzen:
```ts
import { logClaudeNutzung } from '@/lib/claude-tracking'
```

In `generiereRezeptBatch()` nach dem `client.messages.create(...)` Call (die Funktion bekommt `client` als Parameter, also direkt nach `const message = await client.messages.create(...)`):
```ts
const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  messages: [{ role: 'user', content: prompt }],
})

await logClaudeNutzung('rezept', 'claude-sonnet-4-6', message.usage)
```

### `app/api/gerichte/vorschlaege/route.ts` — Operation `'vorschlaege'`

- [ ] **Step 5: Import + Tracking hinzufügen**

Import am Anfang der Datei ergänzen:
```ts
import { logClaudeNutzung } from '@/lib/claude-tracking'
```

Nach dem `client.messages.create(...)` Call:
```ts
const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  messages: [{ role: 'user', content: prompt }],
})

await logClaudeNutzung('vorschlaege', 'claude-sonnet-4-6', message.usage)
```

- [ ] **Step 6: TypeScript-Build prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 7: Alle Tests laufen lassen**

```bash
npx jest --no-coverage
```

Erwartet: Alle bestehenden Tests + neue claude-tracking-Tests PASS.

- [ ] **Step 8: Committen**

```bash
git add lib/claude.ts app/api/zutaten/generieren/route.ts app/api/rezepte/generieren/route.ts app/api/gerichte/vorschlaege/route.ts
git commit -m "feat: Claude API Tracking in allen 4 Calls integriert"
```

---

## Task 4: Deploy

- [ ] **Step 1: Push + Coolify-Deployment starten**

```bash
git push origin master

curl -s -X POST "http://140.82.38.192:8000/api/v1/applications/shpiw0907aj8qielobtzhxt8/restart" \
  -H "Authorization: Bearer 1|ifb2KsFvEc2olgSEuYYhDHltgnXgEPsYZnJgVkYk02033322" \
  -H "Content-Type: application/json"
```

Erwartet: `{"message":"Restart request queued.",...}`

- [ ] **Step 2: Deployment abwarten und verifizieren**

Nach ~2 Minuten: App unter `http://shpiw0907aj8qielobtzhxt8.140.82.38.192.sslip.io` aufrufen und prüfen ob sie lädt.

Da `CLAUDE_DEV_MODE=true` gesetzt ist, werden in Produktion noch keine echten Claude-Calls ausgeführt. Das Tracking greift ab dem Moment, wenn DEV_MODE entfernt wird.

---

## Auswertungs-SQL (zur Referenz)

Nach dem ersten echten Claude-Call kann im Supabase-Dashboard ausgewertet werden:

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
