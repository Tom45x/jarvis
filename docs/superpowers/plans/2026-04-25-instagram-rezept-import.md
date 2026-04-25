# Instagram-Rezept-Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Katja teilt Reels aus Insta direkt in die Jarvis-DB; iOS-Shortcut macht POST → Server scraped Caption → Claude parst → Gericht in DB → Notification zurück.

**Architecture:** Drei dünne Layer — `lib/instagram.ts` (Scrape + URL-Helpers, pure functions), `lib/instagram-parser.ts` (Claude-Call mit Prompt), `app/api/instagram/import/route.ts` (Orchestration mit Token-Check + Dedup). Endpoint returnt immer HTTP 200 mit `ok`-Flag, weil iOS-Shortcuts bei non-2xx abbrechen.

**Tech Stack:** Next.js 16 (App Router), Anthropic SDK (`claude-sonnet-4-6`), Supabase (Postgres), Jest + ts-jest. iOS-Shortcut auf Katjas iPhone als Trigger.

**Spec:** [`docs/superpowers/specs/2026-04-25-instagram-rezept-import-design.md`](../specs/2026-04-25-instagram-rezept-import-design.md)

---

## Task 1: DB-Migration — `quelle_url` + Partial Unique Index

**Files:**
- Create: `app/supabase/migration_instagram_quelle_url.sql`

- [ ] **Step 1: Migration-SQL schreiben**

Datei `app/supabase/migration_instagram_quelle_url.sql`:

```sql
-- Eine neue Spalte: Original-URL des Insta-Reels (Dedup-Key)
ALTER TABLE gerichte
  ADD COLUMN IF NOT EXISTS quelle_url TEXT;

-- Partial Unique-Index: Dedup greift nur, wenn URL gesetzt ist.
-- Bestehende Gerichte (alle quelle_url=NULL) kollidieren nicht.
CREATE UNIQUE INDEX IF NOT EXISTS gerichte_quelle_url_unique
  ON gerichte (quelle_url)
  WHERE quelle_url IS NOT NULL;
```

- [ ] **Step 2: Migration via Supabase MCP ausführen**

Tool `mcp__claude_ai_Supabase__apply_migration` mit `name: "instagram_quelle_url"` und obigem SQL. (Per User-Memory: Migrationen NIE an User delegieren — selbst ausführen.)

- [ ] **Step 3: Verifizieren dass Spalte + Index existieren**

Tool `mcp__claude_ai_Supabase__execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'gerichte' AND column_name = 'quelle_url';

SELECT indexname FROM pg_indexes
WHERE tablename = 'gerichte' AND indexname = 'gerichte_quelle_url_unique';
```

Erwartung: Spalte `quelle_url` mit Typ `text`; Index `gerichte_quelle_url_unique` vorhanden.

- [ ] **Step 4: Commit**

```bash
git add app/supabase/migration_instagram_quelle_url.sql
git commit -m "feat(db): Spalte gerichte.quelle_url für Insta-Import-Dedup"
```

---

## Task 2: TypeScript-Types erweitern

**Files:**
- Modify: `app/types/index.ts`
- Modify: `app/app/api/gerichte/route.ts:13-16`

- [ ] **Step 1: Kategorie-Type um `'instagram'` erweitern**

In `app/types/index.ts` Zeile 14 nach `'saft'` einfügen:

```ts
export type Kategorie =
  | 'fleisch' | 'nudeln' | 'suppe' | 'auflauf' | 'fisch' | 'salat'
  | 'sonstiges' | 'kinder' | 'trainingstage' | 'frühstück' | 'filmabend'
  | 'gesundheitssnack' | 'saft'
  | 'instagram'
```

- [ ] **Step 2: Gericht-Interface erweitern**

In `app/types/index.ts` Zeile 32-33 ändern:

```ts
quelle: 'manuell' | 'themealdb' | 'ki-vorschlag' | 'instagram'
quelle_url?: string
```

- [ ] **Step 3: GUELTIGE_KATEGORIEN-Konstante erweitern**

In `app/app/api/gerichte/route.ts` Zeile 13-16 ändern:

```ts
const GUELTIGE_KATEGORIEN = [
  'fleisch', 'nudeln', 'suppe', 'auflauf', 'fisch', 'salat',
  'sonstiges', 'kinder', 'trainingstage', 'frühstück', 'filmabend',
  'gesundheitssnack', 'saft', 'instagram',
] as const
```

(Anmerkung: `'gesundheitssnack'` und `'saft'` waren in der Konstante noch nicht drin obwohl im Type — bei der Gelegenheit nachziehen.)

- [ ] **Step 4: TypeScript-Compile prüfen**

```bash
cd app && npx tsc --noEmit
```

Erwartung: Exit 0, keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add app/types/index.ts app/app/api/gerichte/route.ts
git commit -m "feat(types): Kategorie und quelle um 'instagram' erweitert"
```

---

## Task 3: `lib/instagram.ts` — URL-Normalize + Caption-Scrape (TDD)

**Files:**
- Create: `app/lib/instagram.ts`
- Test: `app/__tests__/lib/instagram.test.ts`

### Test-Datei zuerst

- [ ] **Step 1: Test-Datei schreiben (alle Tests, schlagen erstmal fehl)**

Datei `app/__tests__/lib/instagram.test.ts`:

```ts
import { normalisiereInstaUrl, holeReelCaption, dekodiereHtmlEntities } from '@/lib/instagram'

describe('normalisiereInstaUrl', () => {
  it('strippt Query-Params', () => {
    const result = normalisiereInstaUrl('https://www.instagram.com/reel/ABC123/?igsh=xyz&utm_source=test')
    expect(result).toBe('https://www.instagram.com/reel/ABC123/')
  })

  it('fügt Trailing-Slash hinzu falls fehlt', () => {
    const result = normalisiereInstaUrl('https://www.instagram.com/reel/ABC123')
    expect(result).toBe('https://www.instagram.com/reel/ABC123/')
  })

  it('akzeptiert /p/ Posts', () => {
    const result = normalisiereInstaUrl('https://www.instagram.com/p/XYZ789/?igsh=foo')
    expect(result).toBe('https://www.instagram.com/p/XYZ789/')
  })

  it('wirft bei ungültiger URL', () => {
    expect(() => normalisiereInstaUrl('https://example.com/foo')).toThrow()
    expect(() => normalisiereInstaUrl('not-a-url')).toThrow()
    expect(() => normalisiereInstaUrl('https://www.instagram.com/profile/')).toThrow()
  })
})

describe('dekodiereHtmlEntities', () => {
  it('dekodiert Hex-Entities', () => {
    expect(dekodiereHtmlEntities('H&#xe4;hnchen')).toBe('Hähnchen')
    expect(dekodiereHtmlEntities('Br&#xfc;he')).toBe('Brühe')
    expect(dekodiereHtmlEntities('Stra&#xdf;e')).toBe('Straße')
  })

  it('dekodiert Decimal-Entities', () => {
    expect(dekodiereHtmlEntities('Caf&#233;')).toBe('Café')
  })

  it('dekodiert Named-Entities', () => {
    expect(dekodiereHtmlEntities('A &amp; B')).toBe('A & B')
    expect(dekodiereHtmlEntities('&quot;Hallo&quot;')).toBe('"Hallo"')
  })

  it('lässt Klartext unangetastet', () => {
    expect(dekodiereHtmlEntities('Hallo Welt')).toBe('Hallo Welt')
  })
})

describe('holeReelCaption', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('extrahiert Caption aus og:description', async () => {
    const html = `<html><head>
      <meta property="og:description" content="Hähnchen Pasta&#x1f357;
Zutaten:
2 H&#xe4;hnchenbr&#xfc;ste
350g Pasta">
    </head></html>`
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => html,
    })

    const result = await holeReelCaption('https://www.instagram.com/reel/ABC/')
    expect(result).not.toBeNull()
    expect(result!.caption).toContain('Hähnchen Pasta')
    expect(result!.caption).toContain('Hähnchenbrüste')
  })

  it('returnt null wenn og:description fehlt', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><head></head><body></body></html>',
    })

    const result = await holeReelCaption('https://www.instagram.com/reel/ABC/')
    expect(result).toBeNull()
  })

  it('returnt null bei HTTP-Fehler', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    })

    const result = await holeReelCaption('https://www.instagram.com/reel/ABC/')
    expect(result).toBeNull()
  })

  it('sendet Mobile-User-Agent', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<meta property="og:description" content="x">',
    })

    await holeReelCaption('https://www.instagram.com/reel/ABC/')
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].headers['User-Agent']).toMatch(/iPhone/)
  })
})
```

- [ ] **Step 2: Tests laufen lassen — sollten alle fehlschlagen**

```bash
cd app && npm test -- __tests__/lib/instagram.test.ts
```

Erwartung: alle Tests FAIL mit `Cannot find module '@/lib/instagram'`.

- [ ] **Step 3: lib/instagram.ts implementieren**

Datei `app/lib/instagram.ts`:

```ts
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const URL_PATTERN = /^https:\/\/(?:www\.)?instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)\/?/

export function normalisiereInstaUrl(url: string): string {
  const match = url.match(URL_PATTERN)
  if (!match) throw new Error(`Keine gültige Instagram-Reel/Post-URL: ${url}`)
  const [, typ, id] = match
  return `https://www.instagram.com/${typ}/${id}/`
}

export function dekodiereHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

export async function holeReelCaption(url: string): Promise<{ caption: string } | null> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': IPHONE_UA },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const html = await response.text()
  const match = html.match(/<meta property="og:description" content="([^"]*)"/)
  if (!match) return null

  const caption = dekodiereHtmlEntities(match[1])
  return { caption }
}
```

- [ ] **Step 4: Tests laufen lassen — sollten alle passen**

```bash
cd app && npm test -- __tests__/lib/instagram.test.ts
```

Erwartung: alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/instagram.ts app/__tests__/lib/instagram.test.ts
git commit -m "feat(instagram): Caption-Scrape + URL-Normalize-Helper"
```

---

## Task 4: `lib/instagram-parser.ts` — Claude-Call (TDD)

**Files:**
- Create: `app/lib/instagram-parser.ts`
- Test: `app/__tests__/lib/instagram-parser.test.ts`

- [ ] **Step 1: Test-Datei schreiben**

Datei `app/__tests__/lib/instagram-parser.test.ts`:

```ts
import { parseRezeptMitClaude } from '@/lib/instagram-parser'

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

jest.mock('@/lib/claude-tracking', () => ({
  logClaudeNutzung: jest.fn().mockResolvedValue(undefined),
}))

describe('parseRezeptMitClaude', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  const validResponse = {
    name: 'Ofen Feta Hähnchen Pasta',
    aufwand: '45 Min',
    gesund: false,
    zutaten: [
      { name: 'Hähnchenbrust', menge: 2, einheit: 'Stück', haltbarkeit_tage: 2 },
      { name: 'Feta', menge: 1, einheit: 'Packung', haltbarkeit_tage: 14 },
      { name: 'Pasta', menge: 350, einheit: 'g', haltbarkeit_tage: 730 },
    ],
    rezept: {
      zutaten: ['2 Hähnchenbrüste', '1 Feta', '350g Pasta'],
      zubereitung: ['Bärlauch klein schneiden.', 'Auflaufform vorbereiten.'],
    },
  }

  function mockClaudeResponse(payload: unknown): void {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      usage: { input_tokens: 100, output_tokens: 200 },
    })
  }

  it('parst valide Claude-Antwort', async () => {
    mockClaudeResponse(validResponse)
    const result = await parseRezeptMitClaude('Caption-Text')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Ofen Feta Hähnchen Pasta')
    expect(result!.aufwand).toBe('45 Min')
    expect(result!.zutaten).toHaveLength(3)
  })

  it('returnt null bei leerem Output', async () => {
    mockClaudeResponse({
      ...validResponse,
      zutaten: [],
      rezept: { zutaten: [], zubereitung: [] },
    })
    const result = await parseRezeptMitClaude('Caption ohne Rezept')
    expect(result).toBeNull()
  })

  it('returnt null bei kaputtem JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'das ist kein json' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    const result = await parseRezeptMitClaude('Caption')
    expect(result).toBeNull()
  })

  it('fallbackt aufwand auf "30 Min" bei ungültigem Wert', async () => {
    mockClaudeResponse({ ...validResponse, aufwand: 'unklar' })
    const result = await parseRezeptMitClaude('Caption')
    expect(result!.aufwand).toBe('30 Min')
  })

  it('droppt zutaten mit ungültiger Einheit', async () => {
    mockClaudeResponse({
      ...validResponse,
      zutaten: [
        { name: 'Hähnchen', menge: 2, einheit: 'Stück', haltbarkeit_tage: 2 },
        { name: 'Mystery', menge: 1, einheit: 'Wagenladung', haltbarkeit_tage: 1 },
      ],
    })
    const result = await parseRezeptMitClaude('Caption')
    expect(result!.zutaten).toHaveLength(1)
    expect(result!.zutaten[0].name).toBe('Hähnchen')
  })

  it('extrahiert JSON auch wenn umschließender Text vorhanden', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: `Hier ist das JSON:\n${JSON.stringify(validResponse)}\nViel Spaß!` }],
      usage: { input_tokens: 100, output_tokens: 200 },
    })
    const result = await parseRezeptMitClaude('Caption')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Ofen Feta Hähnchen Pasta')
  })

  it('loggt Claude-Nutzung als operation="instagram-import"', async () => {
    const { logClaudeNutzung } = await import('@/lib/claude-tracking')
    mockClaudeResponse(validResponse)
    await parseRezeptMitClaude('Caption')
    expect(logClaudeNutzung).toHaveBeenCalledWith(
      'instagram-import',
      'claude-sonnet-4-6',
      { input_tokens: 100, output_tokens: 200 }
    )
  })
})
```

- [ ] **Step 2: Tests laufen lassen — alle FAIL**

```bash
cd app && npm test -- __tests__/lib/instagram-parser.test.ts
```

Erwartung: FAIL mit `Cannot find module '@/lib/instagram-parser'`.

- [ ] **Step 3: Parser-Modul implementieren**

Datei `app/lib/instagram-parser.ts`:

```ts
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
```

- [ ] **Step 4: Tests laufen lassen — alle PASS**

```bash
cd app && npm test -- __tests__/lib/instagram-parser.test.ts
```

Erwartung: alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/instagram-parser.ts app/__tests__/lib/instagram-parser.test.ts
git commit -m "feat(instagram): Claude-Parser für Reel-Caption → Gericht"
```

---

## Task 5: API-Route `POST /api/instagram/import` (TDD)

**Files:**
- Create: `app/app/api/instagram/import/route.ts`
- Test: `app/__tests__/api/instagram-import.test.ts`

- [ ] **Step 1: Test-Datei schreiben**

Datei `app/__tests__/api/instagram-import.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { POST } from '@/app/api/instagram/import/route'

const mockHoleReelCaption = jest.fn()
const mockParseRezeptMitClaude = jest.fn()
const mockSupabaseFrom = jest.fn()

jest.mock('@/lib/instagram', () => ({
  normalisiereInstaUrl: jest.requireActual('@/lib/instagram').normalisiereInstaUrl,
  holeReelCaption: (...args: unknown[]) => mockHoleReelCaption(...args),
}))

jest.mock('@/lib/instagram-parser', () => ({
  parseRezeptMitClaude: (...args: unknown[]) => mockParseRezeptMitClaude(...args),
}))

jest.mock('@/lib/supabase-server', () => ({
  supabase: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/instagram/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/instagram/import', () => {
  beforeEach(() => {
    mockHoleReelCaption.mockReset()
    mockParseRezeptMitClaude.mockReset()
    mockSupabaseFrom.mockReset()
    process.env.INSTA_IMPORT_TOKEN = 'secret-test-token'
  })

  it('lehnt ungültigen Token ab', async () => {
    const res = await POST(makeRequest({ url: 'https://www.instagram.com/reel/ABC/', token: 'falsch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: 'Ungültiger Token' })
  })

  it('lehnt ungültige URL ab', async () => {
    const res = await POST(makeRequest({ url: 'https://example.com/foo', token: 'secret-test-token' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Keine gültige Instagram-URL')
  })

  it('returnt existing=true bei Dedup-Treffer', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'g-123', name: 'Ofen Feta' }, error: null }),
        }),
      }),
    })

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC123/?igsh=xyz',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      existing: true,
      gericht_id: 'g-123',
      gericht_name: 'Ofen Feta',
    })
    expect(mockHoleReelCaption).not.toHaveBeenCalled()
  })

  it('legt neues Gericht an bei Erfolg', async () => {
    let dedupCall = 0
    mockSupabaseFrom.mockImplementation(() => {
      dedupCall++
      if (dedupCall === 1) {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }
      }
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'new-id', name: 'Test' }, error: null }),
          }),
        }),
      }
    })
    mockHoleReelCaption.mockResolvedValue({ caption: 'Caption-Text' })
    mockParseRezeptMitClaude.mockResolvedValue({
      name: 'Test', aufwand: '30 Min', gesund: false,
      zutaten: [], rezept: { zutaten: ['x'], zubereitung: ['y'] },
    })

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC/',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      existing: false,
      gericht_id: 'new-id',
      gericht_name: 'Test',
    })
  })

  it('returnt Fehler wenn Insta keine Caption liefert', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    })
    mockHoleReelCaption.mockResolvedValue(null)

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC/',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('privat oder gelöscht')
  })

  it('returnt Fehler wenn Claude null returnt', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    })
    mockHoleReelCaption.mockResolvedValue({ caption: 'random' })
    mockParseRezeptMitClaude.mockResolvedValue(null)

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC/',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('Rezept konnte nicht extrahiert werden')
  })

  it('returnt immer HTTP 200, auch bei Fehlern', async () => {
    const res1 = await POST(makeRequest({ url: 'x', token: 'falsch' }))
    expect(res1.status).toBe(200)
    const res2 = await POST(makeRequest({ url: 'https://example.com/', token: 'secret-test-token' }))
    expect(res2.status).toBe(200)
  })
})
```

- [ ] **Step 2: Tests laufen — alle FAIL**

```bash
cd app && npm test -- __tests__/api/instagram-import.test.ts
```

- [ ] **Step 3: Route implementieren**

Datei `app/app/api/instagram/import/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { normalisiereInstaUrl, holeReelCaption } from '@/lib/instagram'
import { parseRezeptMitClaude } from '@/lib/instagram-parser'

export const maxDuration = 60

type Erfolg = { ok: true; existing: boolean; gericht_id: string; gericht_name: string }
type Misserfolg = { ok: false; error: string }
type Antwort = Erfolg | Misserfolg

function ok200(body: Antwort): NextResponse {
  return NextResponse.json(body, { status: 200 })
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null) as { url?: string; token?: string } | null
  if (!body?.url || !body?.token) {
    return ok200({ ok: false, error: 'url und token erforderlich' })
  }

  if (body.token !== process.env.INSTA_IMPORT_TOKEN) {
    return ok200({ ok: false, error: 'Ungültiger Token' })
  }

  let normalizedUrl: string
  try {
    normalizedUrl = normalisiereInstaUrl(body.url)
  } catch {
    return ok200({ ok: false, error: 'Keine gültige Instagram-URL' })
  }

  // Dedup-Check
  const { data: existing } = await supabase
    .from('gerichte')
    .select('id, name')
    .eq('quelle_url', normalizedUrl)
    .maybeSingle()

  if (existing) {
    return ok200({
      ok: true,
      existing: true,
      gericht_id: existing.id,
      gericht_name: existing.name,
    })
  }

  // Insta-Scrape
  const scrape = await holeReelCaption(normalizedUrl)
  if (!scrape) {
    console.error('[insta-import] Kein og:description für', normalizedUrl)
    return ok200({ ok: false, error: 'Konnte das Reel nicht öffnen — vielleicht privat oder gelöscht?' })
  }

  // Claude-Parse
  const parsed = await parseRezeptMitClaude(scrape.caption)
  if (!parsed) {
    console.error('[insta-import] Claude-Parse-Fail für', normalizedUrl, '\nCaption:', scrape.caption)
    return ok200({ ok: false, error: 'Rezept konnte nicht extrahiert werden' })
  }

  // Insert
  const { data: inserted, error: insertError } = await supabase
    .from('gerichte')
    .insert({
      name: parsed.name,
      kategorie: 'instagram',
      quelle: 'instagram',
      quelle_url: normalizedUrl,
      aufwand: parsed.aufwand,
      gesund: parsed.gesund,
      zutaten: parsed.zutaten,
      rezept: parsed.rezept,
      bewertung: 3,
      tausch_count: 0,
      gesperrt: false,
      beliebtheit: {},
    })
    .select('id, name')
    .single()

  if (insertError || !inserted) {
    console.error('[insta-import] Insert-Fehler:', insertError)
    return ok200({ ok: false, error: 'Speichern fehlgeschlagen' })
  }

  return ok200({
    ok: true,
    existing: false,
    gericht_id: inserted.id,
    gericht_name: inserted.name,
  })
}
```

- [ ] **Step 4: Tests laufen — alle PASS**

```bash
cd app && npm test -- __tests__/api/instagram-import.test.ts
```

- [ ] **Step 5: Gesamt-Test-Suite laufen, sicherstellen dass nichts kaputt ist**

```bash
cd app && npm test
```

Erwartung: alle Tests PASS, keine Regressionen.

- [ ] **Step 6: Commit**

```bash
git add app/app/api/instagram/import/route.ts app/__tests__/api/instagram-import.test.ts
git commit -m "feat(insta-import): API-Route mit Token-Auth, Dedup und Always-200-Pattern"
```

---

## Task 6: ENV-Variable + lokaler End-to-End-Test

**Files:**
- Modify: `app/.env.local` (lokal, NICHT committen)
- Modify: `app/.env.example` (für Doku)

- [ ] **Step 1: Token generieren und lokal setzen**

```bash
# Sicheren Token erzeugen (32 zufällige Bytes als hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Den Output (Beispiel: `a1b2c3...`) in `app/.env.local` ergänzen:

```
INSTA_IMPORT_TOKEN=<generierter-token>
```

- [ ] **Step 2: `.env.example` erweitern (für Doku)**

In `app/.env.example` Zeile am Ende anhängen:

```
# Token für POST /api/instagram/import (vom iOS-Shortcut gesendet)
INSTA_IMPORT_TOKEN=
```

- [ ] **Step 3: Dev-Server starten**

```bash
cd app && npm run dev
```

Im Hintergrund laufen lassen.

- [ ] **Step 4: Echten End-to-End-Test mit dem `joeskochwelt`-Reel**

Mit echtem Token aus `.env.local`:

```bash
curl -sS -X POST http://localhost:3000/api/instagram/import \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.instagram.com/reel/DWYVjJLDCMc/\",\"token\":\"<dein-token>\"}" \
  | jq .
```

Erwartung:
```json
{
  "ok": true,
  "existing": false,
  "gericht_id": "<uuid>",
  "gericht_name": "Ofen Feta Hähnchen Pasta"
}
```

- [ ] **Step 5: Dedup verifizieren — gleicher Aufruf nochmal**

```bash
# Gleicher curl wie oben
```

Erwartung: `"existing": true`, gleiche `gericht_id`.

- [ ] **Step 6: Falscher Token verifizieren**

```bash
curl -sS -X POST http://localhost:3000/api/instagram/import \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.instagram.com/reel/DWYVjJLDCMc/\",\"token\":\"falsch\"}" \
  | jq .
```

Erwartung: `{ "ok": false, "error": "Ungültiger Token" }`, HTTP 200.

- [ ] **Step 7: Gericht in DB inspizieren**

Tool `mcp__claude_ai_Supabase__execute_sql`:

```sql
SELECT id, name, kategorie, quelle, quelle_url, aufwand, gesund,
       jsonb_array_length(zutaten) as zutaten_count,
       jsonb_array_length(rezept->'zubereitung') as schritte_count
FROM gerichte
WHERE quelle_url LIKE '%DWYVjJLDCMc%';
```

Erwartung: Genau 1 Zeile, `kategorie='instagram'`, `quelle='instagram'`, mehrere Zutaten und Schritte.

- [ ] **Step 8: Aufräumen — Test-Gericht löschen**

```sql
DELETE FROM gerichte WHERE quelle_url LIKE '%DWYVjJLDCMc%';
```

(Wichtig: NICHT in Produktion lassen — der Reel soll später von Katja sauber importiert werden, nicht vom Test übrig bleiben.)

- [ ] **Step 9: Commit der `.env.example`-Änderung**

```bash
git add app/.env.example
git commit -m "docs(env): INSTA_IMPORT_TOKEN in .env.example dokumentieren"
```

---

## Task 7: Production-Deployment + iOS-Shortcut

> **Wichtig (per User-Memory "Lokal vor Deploy"):** Nach Task 6 dem User explizit zeigen, dass alles lokal funktioniert, und FRAGEN, ob deployed werden soll. Erst nach explizitem Go zu Schritt 1 dieses Tasks.

- [ ] **Step 1: User um Deploy-Freigabe fragen**

Output an User: "Lokaler End-to-End-Test ist erfolgreich (siehe Task-6-Ergebnisse). Soll ich `INSTA_IMPORT_TOKEN` in Coolify setzen und auf Production pushen?"

→ Auf User-Antwort warten.

- [ ] **Step 2: Token in Coolify-ENV eintragen**

Wenn User-Go: Den lokal generierten Token in Coolify (App-Settings → Environment Variables) als `INSTA_IMPORT_TOKEN` setzen. **Token NICHT in Slack/Mail/Chat schicken.**

- [ ] **Step 3: Code pushen**

```bash
git push origin master
```

Coolify deployed automatisch. Warten bis Build durch ist.

- [ ] **Step 4: Production-End-to-End-Test**

```bash
curl -sS -X POST https://<jarvis-url>/api/instagram/import \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://www.instagram.com/reel/DWYVjJLDCMc/\",\"token\":\"<production-token>\"}" \
  | jq .
```

Erwartung: `ok: true`, `existing: false`, neues Gericht in DB.

Anschließend Test-Gericht wieder per SQL löschen.

- [ ] **Step 5: iOS-Shortcut auf Thomas' iPhone bauen**

Manuell auf dem iPhone:

1. Kurzbefehle-App öffnen → "+" für neuen Shortcut
2. **Action 1:** "Eingabe aus Teilen-Sheet erhalten" → Typ: URLs
3. **Action 2:** "Inhalte von URL abrufen"
   - URL: `https://<jarvis-url>/api/instagram/import`
   - Methode: POST
   - Header: `Content-Type` = `application/json`
   - Anfragetext: JSON
     ```json
     {
       "url": "<<Shortcut-Eingabe>>",
       "token": "<production-token>"
     }
     ```
4. **Action 3:** "Wörterbuchwert abrufen" → Schlüssel: `ok` aus dem Ergebnis
5. **Action 4:** "Falls" → Wert ist `true`
   - Then: "Wörterbuchwert abrufen" → Schlüssel: `gericht_name` → "Mitteilung anzeigen": `✓ Importiert: <gericht_name>`
   - Else: "Wörterbuchwert abrufen" → Schlüssel: `error` → "Mitteilung anzeigen": `⚠️ <error>`
6. Shortcut-Name: "An Jarvis senden"
7. Im Share-Sheet aktivieren: Settings → Share-Sheet → Aktiviert
8. Test mit echtem Reel aus Insta heraus → Notification sollte erscheinen

- [ ] **Step 6: Shortcut für Katja als iCloud-Link teilen**

In Kurzbefehle-App: Shortcut-Settings → "Teilen" → "iCloud-Link erstellen" → Link an Katja per Messenger.

Katja: Link antippen → "Hinzufügen" → Shortcut steht in ihrem Share-Sheet.

- [ ] **Step 7: Katjas erster Test-Import**

Katja teilt aus Insta einen Reel an "An Jarvis senden". Notification "✓ Importiert" sollte erscheinen.

In Jarvis-App unter Gerichte → Filter "instagram" sollte das neue Gericht stehen.

- [ ] **Step 8: Memory-Update für Future-Sessions**

`memory/project_stand.md` updaten: "Instagram-Rezept-Import deployed (DATUM)" zu den deployed Features hinzufügen, von TODO-Liste streichen.

---

## Definition-of-Done (aus Spec)

- [x] Migration durchgelaufen, `quelle_url` + Unique-Index in DB *(Task 1)*
- [x] `POST /api/instagram/import` lokal getestet mit dem `joeskochwelt` Reel *(Task 6)*
- [x] iOS-Shortcut auf Thomas' iPhone funktioniert end-to-end *(Task 7 Step 5)*
- [x] iCloud-Link an Katja, Shortcut installiert, Test-Import erfolgreich *(Task 7 Step 6-7)*
- [x] Importiertes Gericht ist unter Kategorie "instagram" sichtbar *(Task 7 Step 7)*
