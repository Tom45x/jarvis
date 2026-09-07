# Gericht-Vorschläge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude schlägt auf Anfrage 3 neue Gerichte vor, die zur Familie passen und noch nicht in der DB sind. Vorschläge werden mit TheMealDB-Rezeptlinks angereichert. Hinzugefügte Gerichte bekommen automatisch Zutaten generiert.

**Architecture:** Neues `lib/themealdb.ts` für die Rezept-URL-Suche. Neue API Route `/api/gerichte/vorschlaege` ruft Claude auf und reichert jeden Vorschlag mit TheMealDB an. Neue POST-Route in `/api/gerichte` zum Anlegen von Gerichten. Die Gerichte-Seite bekommt eine "Neue Gerichte entdecken" Sektion.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Anthropic SDK, TheMealDB Public API (kostenlos, kein Key)

---

## Dateistruktur

```
Neu:
  lib/themealdb.ts                          TheMealDB Such-Wrapper
  app/api/gerichte/vorschlaege/route.ts     Claude + TheMealDB-Anreicherung

Geändert:
  app/api/gerichte/route.ts                 + POST Handler (Gericht anlegen)
  app/gerichte/page.tsx                     + Vorschläge-Sektion
```

---

### Task 1: lib/themealdb.ts

**Files:**
- Create: `lib/themealdb.ts`

- [ ] **Step 1: TheMealDB-Wrapper schreiben**

Erstelle `lib/themealdb.ts`:

```typescript
interface MealDbResponse {
  meals: Array<{ idMeal: string; strMeal: string }> | null
}

export async function sucheRezeptUrl(name: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(name)
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encoded}`
    )
    if (!res.ok) return null
    const data = await res.json() as MealDbResponse
    if (!data.meals || data.meals.length === 0) return null
    return `https://www.themealdb.com/meal/${data.meals[0].idMeal}`
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Manuell testen**

In der Konsole prüfen (Node.js REPL oder curl):

```bash
curl "https://www.themealdb.com/api/json/v1/1/search.php?s=Spaghetti+Bolognese"
```

Erwartete Ausgabe: JSON mit `meals[0].idMeal` vorhanden.

- [ ] **Step 3: Commit**

```bash
git add lib/themealdb.ts
git commit -m "feat: add TheMealDB rezept-url lookup"
```

---

### Task 2: API Route — /api/gerichte/vorschlaege

**Files:**
- Create: `app/api/gerichte/vorschlaege/route.ts`

- [ ] **Step 1: Route anlegen**

Erstelle `app/api/gerichte/vorschlaege/route.ts`:

```typescript
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

  // TheMealDB Lookup parallel für alle Vorschläge
  const angereichert: GericherVorschlag[] = await Promise.all(
    vorschlaege.map(async (v) => ({
      ...v,
      rezept_url: await sucheRezeptUrl(v.name),
    }))
  )

  return NextResponse.json(angereichert)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/gerichte/vorschlaege/route.ts
git commit -m "feat: add gerichte/vorschlaege route with Claude + TheMealDB"
```

---

### Task 3: POST /api/gerichte — Gericht anlegen

**Files:**
- Modify: `app/api/gerichte/route.ts`

- [ ] **Step 1: POST-Handler zur bestehenden GET-Route hinzufügen**

`app/api/gerichte/route.ts` vollständig ersetzen:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('gerichte')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string
    kategorie: string
    aufwand: string
    gesund?: boolean
    quelle?: string
  }

  const { data, error } = await supabase
    .from('gerichte')
    .insert({
      name: body.name,
      kategorie: body.kategorie,
      aufwand: body.aufwand,
      gesund: body.gesund ?? false,
      quelle: body.quelle ?? 'themealdb',
      zutaten: [],
      beliebtheit: {},
      tausch_count: 0,
      gesperrt: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/gerichte/route.ts
git commit -m "feat: add POST handler to gerichte route"
```

---

### Task 4: Gerichte-Seite — Vorschläge-Sektion

**Files:**
- Modify: `app/gerichte/page.tsx`

- [ ] **Step 1: State für Vorschläge hinzufügen**

In `app/gerichte/page.tsx` nach den bestehenden State-Definitionen einfügen:

```typescript
const [vorschlaege, setVorschlaege] = useState<Array<{
  name: string
  kategorie: string
  aufwand: string
  beschreibung: string
  rezept_url: string | null
}>>([])
const [vorschlagHinweis, setVorschlagHinweis] = useState('')
const [ladeVorschlaege, setLadeVorschlaege] = useState(false)
const [fuegeHinzu, setFuegeHinzu] = useState<string | null>(null)
```

- [ ] **Step 2: Handler-Funktionen hinzufügen**

Nach den bestehenden Funktionen einfügen:

```typescript
async function vorschlaegeGenerieren() {
  setLadeVorschlaege(true)
  setMeldung(null)
  try {
    const res = await fetch('/api/gerichte/vorschlaege', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hinweis: vorschlagHinweis }),
    })
    if (!res.ok) throw new Error('Fehler beim Generieren')
    setVorschlaege(await res.json())
  } catch (e: unknown) {
    setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
  } finally {
    setLadeVorschlaege(false)
  }
}

async function vorschlagHinzufuegen(vorschlag: typeof vorschlaege[0]) {
  setFuegeHinzu(vorschlag.name)
  try {
    // 1. Gericht anlegen
    const res = await fetch('/api/gerichte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: vorschlag.name,
        kategorie: vorschlag.kategorie,
        aufwand: vorschlag.aufwand,
        gesund: false,
        quelle: 'themealdb',
      }),
    })
    if (!res.ok) throw new Error('Anlegen fehlgeschlagen')
    const neuesGericht = await res.json()

    // 2. Zutaten generieren
    await fetch('/api/zutaten/generieren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gerichtId: neuesGericht.id }),
    })

    // 3. Liste aktualisieren + Vorschlag entfernen
    const updated = await fetch('/api/gerichte').then(r => r.json())
    setGerichte(updated)
    setVorschlaege(prev => prev.filter(v => v.name !== vorschlag.name))
    setMeldung(`✅ ${vorschlag.name} hinzugefügt und Zutaten generiert`)
  } catch (e: unknown) {
    setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
  } finally {
    setFuegeHinzu(null)
  }
}
```

- [ ] **Step 3: Vorschläge-Sektion ins JSX einfügen**

Direkt nach dem `{meldung && ...}` Block und vor der Gerichte-Liste einfügen:

```tsx
{/* Neue Gerichte entdecken */}
<div className="mb-8 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
  <h2 className="text-base font-semibold text-gray-700 mb-3">Neue Gerichte entdecken</h2>
  <div className="flex gap-2 mb-4">
    <input
      type="text"
      value={vorschlagHinweis}
      onChange={e => setVorschlagHinweis(e.target.value)}
      placeholder="Worauf habt ihr Lust? (optional, z.B. mehr Fisch)"
      className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
    />
    <button
      onClick={vorschlaegeGenerieren}
      disabled={ladeVorschlaege}
      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0"
    >
      {ladeVorschlaege ? 'Generiere...' : '3 Vorschläge generieren'}
    </button>
  </div>

  {vorschlaege.length > 0 && (
    <div className="space-y-3">
      {vorschlaege.map(v => (
        <div key={v.name} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1">
              <p className="font-medium text-gray-900">{v.name}</p>
              <p className="text-sm text-gray-500 mt-1">{v.beschreibung}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                  {v.kategorie}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                  {v.aufwand}
                </span>
                {v.rezept_url && (
                  <a
                    href={v.rezept_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Rezept ansehen →
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => vorschlagHinzufuegen(v)}
                disabled={fuegeHinzu === v.name}
                className="text-sm bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 disabled:opacity-50"
              >
                {fuegeHinzu === v.name ? 'Füge hinzu...' : 'Hinzufügen'}
              </button>
              <button
                onClick={() => setVorschlaege(prev => prev.filter(x => x.name !== v.name))}
                className="text-sm text-gray-400 hover:text-gray-600 rounded px-3 py-1.5"
              >
                Überspringen
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/gerichte/page.tsx
git commit -m "feat: add gericht-vorschlaege section to gerichte page"
```
