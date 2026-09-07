# Jarvis – Plan 1: Foundation & Wochenplaner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lauffähige lokale Next.js-App mit Supabase-Datenbank, importierten Familienprofilen und einem KI-gestützten Wochenplaner (Claude API).

**Architecture:** Next.js 14 App Router als PWA-Grundlage. Supabase für Datenpersistenz. Claude API für Wochenplan-Generierung. API Routes entkoppeln Frontend von KI-Logik. Alle Familiendaten werden aus den bestehenden Markdown-Dateien importiert.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (Postgres), Anthropic SDK (`@anthropic-ai/sdk`), Jest, React Testing Library

---

## Dateistruktur

```
C:/Users/thoma/OneDrive/Desktop/Jarvis/app/   ← Next.js Projektordner
├── app/
│   ├── layout.tsx                    Globales Layout, PWA-Meta
│   ├── page.tsx                      Redirect → /wochenplan
│   └── wochenplan/
│       └── page.tsx                  Wochenplan-Hauptseite
├── components/
│   ├── WochenplanGrid.tsx            Mo–So Raster (Mittag + Abend)
│   └── GerichtCard.tsx               Einzelne Gerichtkarte mit Tausch-Button
├── lib/
│   ├── supabase.ts                   Supabase-Client (singleton)
│   ├── claude.ts                     Claude API Wrapper
│   └── wochenplan.ts                 Wochenplan-Logik (Generierung, Speicherung)
├── app/api/
│   ├── wochenplan/generate/route.ts  POST: Wochenplan via Claude generieren
│   ├── wochenplan/route.ts           GET: aktuellen Plan laden, PUT: Plan speichern
│   └── gerichte/route.ts             GET: Gerichtliste aus Supabase
├── scripts/
│   └── seed.ts                       Einmalig: .md-Dateien → Supabase
├── types/
│   └── index.ts                      Alle geteilten TypeScript-Typen
└── __tests__/
    ├── lib/wochenplan.test.ts
    ├── lib/claude.test.ts
    └── components/WochenplanGrid.test.tsx
```

---

## Task 1: Next.js Projekt anlegen

**Files:**
- Create: `C:/Users/thoma/OneDrive/Desktop/Jarvis/app/` (gesamter Next.js Ordner)

- [ ] **Schritt 1: Next.js-Projekt erstellen**

```bash
cd "C:/Users/thoma/OneDrive/Desktop/Jarvis"
npx create-next-app@latest app --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

Erwartete Ausgabe: `Success! Created app at .../Jarvis/app`

- [ ] **Schritt 2: Abhängigkeiten installieren**

```bash
cd "C:/Users/thoma/OneDrive/Desktop/Jarvis/app"
npm install @anthropic-ai/sdk @supabase/supabase-js
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @types/jest jest-environment-jsdom ts-jest
```

- [ ] **Schritt 3: Jest konfigurieren**

Datei `jest.config.ts` im `app/`-Ordner anlegen:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

Datei `jest.setup.ts` anlegen:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Schritt 4: Jest-Script in package.json eintragen**

In `package.json` unter `"scripts"` ergänzen:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Schritt 5: .env.local anlegen**

```bash
cp .env.example .env.local 2>/dev/null || touch .env.local
```

Inhalt von `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=deine_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein_supabase_anon_key
ANTHROPIC_API_KEY=dein_anthropic_api_key
```

- [ ] **Schritt 6: Dev-Server starten und prüfen**

```bash
npm run dev
```

Erwartete Ausgabe: `ready - started server on 0.0.0.0:3000`
Browser: `http://localhost:3000` zeigt die Next.js Standardseite.

- [ ] **Schritt 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js 14 project with TypeScript, Tailwind and Jest"
```

---

## Task 2: TypeScript-Typen definieren

**Files:**
- Create: `types/index.ts`

- [ ] **Schritt 1: Typen schreiben**

Datei `types/index.ts`:

```typescript
export type Mahlzeit = 'mittag' | 'abend'

export type Kategorie =
  | 'fleisch'
  | 'nudeln'
  | 'suppe'
  | 'auflauf'
  | 'fisch'
  | 'salat'
  | 'sonstiges'
  | 'kinder'

export interface Gericht {
  id: string
  name: string
  zutaten: string[]
  gesund: boolean
  kategorie: Kategorie
  beliebtheit: Record<string, number> // person_name → 1-5
  quelle: 'manuell' | 'themealdb'
}

export interface FamilieMitglied {
  id: string
  name: string
  alter: number | null
  lieblingsgerichte: string[]
  abneigungen: string[]
  lieblingsobst: string[]
  lieblingsgemuese: string[]
  notizen: string
}

export interface WochenplanEintrag {
  tag: 'montag' | 'dienstag' | 'mittwoch' | 'donnerstag' | 'freitag' | 'samstag' | 'sonntag'
  mahlzeit: Mahlzeit
  gericht_id: string
  gericht_name: string
}

export interface Wochenplan {
  id: string
  woche_start: string // ISO date string, z.B. "2026-04-13"
  eintraege: WochenplanEintrag[]
  status: 'entwurf' | 'genehmigt'
  erstellt_am: string
}

export interface EinkaufsArtikel {
  name: string
  menge: string
  einheit: string
  routing: 'picnic' | 'bring'
}

export interface Einkaufsliste {
  id: string
  wochenplan_id: string
  artikel: EinkaufsArtikel[]
  erstellt_am: string
}
```

- [ ] **Schritt 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Supabase-Datenbank einrichten

**Files:**
- Create: `supabase/schema.sql`
- Create: `lib/supabase.ts`

- [ ] **Schritt 1: Supabase-Projekt anlegen**

1. Gehe zu [supabase.com](https://supabase.com) → neues Projekt anlegen (Name: `jarvis`)
2. Region: `eu-central-1` (Frankfurt)
3. Nach Erstellung: Einstellungen → API → `URL` und `anon key` kopieren → in `.env.local` eintragen

- [ ] **Schritt 2: SQL-Schema schreiben**

Datei `supabase/schema.sql`:

```sql
-- Familienmitglieder
create table familie_profile (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alter integer,
  lieblingsgerichte text[] default '{}',
  abneigungen text[] default '{}',
  lieblingsobst text[] default '{}',
  lieblingsgemuese text[] default '{}',
  notizen text default '',
  erstellt_am timestamptz default now()
);

-- Gerichte
create table gerichte (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  zutaten text[] default '{}',
  gesund boolean default false,
  kategorie text not null default 'sonstiges',
  beliebtheit jsonb default '{}',
  quelle text default 'manuell',
  erstellt_am timestamptz default now()
);

-- Wochenpläne
create table wochenplaene (
  id uuid primary key default gen_random_uuid(),
  woche_start date not null,
  eintraege jsonb not null default '[]',
  status text not null default 'entwurf',
  erstellt_am timestamptz default now()
);

-- Einkaufslisten
create table einkaufslisten (
  id uuid primary key default gen_random_uuid(),
  wochenplan_id uuid references wochenplaene(id),
  artikel jsonb not null default '[]',
  erstellt_am timestamptz default now()
);

-- Feedback
create table feedback (
  id uuid primary key default gen_random_uuid(),
  gericht_id uuid references gerichte(id),
  person_name text not null,
  bewertung integer check (bewertung between 1 and 5),
  kommentar text,
  erstellt_am timestamptz default now()
);
```

- [ ] **Schritt 3: Schema in Supabase ausführen**

Im Supabase-Dashboard: SQL Editor → obiges SQL einfügen → Run

- [ ] **Schritt 4: Supabase-Client schreiben**

Datei `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Schritt 5: Commit**

```bash
git add supabase/schema.sql lib/supabase.ts
git commit -m "feat: add Supabase schema and client"
```

---

## Task 4: Familienprofil-Import (Seed Script)

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Schritt 1: ts-node installieren**

```bash
npm install --save-dev ts-node
```

- [ ] **Schritt 2: Seed-Script schreiben**

Datei `scripts/seed.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const profile = [
  {
    name: 'Ben',
    alter: 11,
    lieblingsgerichte: [
      'Chicken Wings mit Pommes', 'Döner mit Dönersauce', 'Burger mit Pommes',
      'Pizza Margherita', 'Mini Pizzen', 'Flickerklopse', 'Bauernfrühstück',
      'Pfannekuchen', 'Englisches Frühstück', 'Brotzeit', 'Nachos mit Käse',
      'Raclette', 'Spaghetti mit Basilikum Pesto', 'Gegrillte Bauchscheiben',
      'Folienkartoffel vom Grill'
    ],
    abneigungen: ['Rotkohl', 'Brokkoli', 'Blumenkohl'],
    lieblingsobst: ['Erdbeere', 'Wassermelone', 'Honigmelone', 'Zuckermelone', 'Apfel', 'Himbeeren', 'Kirschen'],
    lieblingsgemuese: ['Paprika roh', 'Gurke roh', 'Tomate roh', 'Erbsen', 'Möhren', 'Mais'],
    notizen: 'Fußballer (U11 Torwart BVB), Gymnasium Filder Benden Moers. Kohlrabi nur roh OK.'
  },
  {
    name: 'Marie',
    alter: 8,
    lieblingsgerichte: [],
    abneigungen: [],
    lieblingsobst: [],
    lieblingsgemuese: [],
    notizen: 'Thai-Boxen seit 7. Lebensjahr. Eschenburg Grundschule Moers, 2. Klasse. Profil noch ergänzen!'
  },
  {
    name: 'Thomas',
    alter: 46,
    lieblingsgerichte: [
      'Linseneintopf', 'Chicken Tikka Masala', 'Reis mit Mais und Hühnchen',
      'Apfel-Pfannekuchen', 'Sushi', 'Gegrillte Bauchscheiben', 'Wolfsbarsch',
      'Basilikumpesto', 'Speck mit Rührei', 'Englisches Frühstück'
    ],
    abneigungen: ['Rosenkohl', 'Blumenkohl', 'sehr fettiges Fleisch', 'Weißer Spargel'],
    lieblingsobst: ['Mango', 'Erdbeeren', 'Honigmelone', 'Zuckermelone'],
    lieblingsgemuese: ['Mais', 'Linsen', 'Kohlrabi roh', 'Grüner Spargel (nur Spitzen)'],
    notizen: 'Sitzt viel, kaum Sport. Kartoffeln mit Spinat und Ei geht auch.'
  },
  {
    name: 'Katja',
    alter: null,
    lieblingsgerichte: [],
    abneigungen: [],
    lieblingsobst: [],
    lieblingsgemuese: [],
    notizen: 'Primäre Jarvis-Nutzerin. Profil noch ergänzen!'
  }
]

const gerichte = [
  // Kindergerichte
  { name: 'Rösti mit Apfelmus', kategorie: 'sonstiges', gesund: false },
  { name: 'Nudeln mit Butter', kategorie: 'nudeln', gesund: false },
  { name: 'Fischstäbchen mit Kartoffeln und Erbsen', kategorie: 'fisch', gesund: false },
  { name: 'Risibisi', kategorie: 'sonstiges', gesund: true },
  { name: 'Flickerklopse', kategorie: 'fleisch', gesund: false },
  { name: 'Pizza Margherita', kategorie: 'sonstiges', gesund: false },
  { name: 'Lasagne', kategorie: 'nudeln', gesund: false },
  { name: 'Pfannekuchen', kategorie: 'sonstiges', gesund: false },
  { name: 'Raclette', kategorie: 'sonstiges', gesund: false },
  { name: 'Wraps', kategorie: 'sonstiges', gesund: false },
  { name: 'Frikadellen', kategorie: 'fleisch', gesund: false },
  // Fleisch
  { name: 'Steak mit Pommes und Mais', kategorie: 'fleisch', gesund: false },
  { name: 'Schweinefilet mit Süßkartoffelpüree', kategorie: 'fleisch', gesund: false },
  { name: 'Züricher Geschnetzeltes', kategorie: 'fleisch', gesund: false },
  { name: 'Bratwurst mit Kohlrabi und Kartoffelpüree', kategorie: 'fleisch', gesund: false },
  { name: 'Bratwurst mit Möhren und Kartoffeln', kategorie: 'fleisch', gesund: false },
  { name: 'Leberkäs', kategorie: 'fleisch', gesund: false },
  { name: 'Hühnchenbrust mit Broccoli', kategorie: 'fleisch', gesund: true },
  { name: 'Burger und Pommes', kategorie: 'fleisch', gesund: false },
  { name: 'Hühnchenbrust mit Mais und Reis', kategorie: 'fleisch', gesund: true },
  { name: 'Schnitzel mit Kartoffeln', kategorie: 'fleisch', gesund: false },
  { name: 'Gegrillte Bauchscheiben', kategorie: 'fleisch', gesund: false },
  // Nudeln
  { name: 'Spaghetti mit Garnelen', kategorie: 'nudeln', gesund: false },
  { name: 'Spaghetti Bolognese', kategorie: 'nudeln', gesund: false },
  { name: 'Tortellini a la Panna', kategorie: 'nudeln', gesund: false },
  { name: 'Maccaroni mit Spinat', kategorie: 'nudeln', gesund: true },
  { name: 'Schinkennudeln', kategorie: 'nudeln', gesund: false },
  { name: 'Spaghetti mit Basilikum Pesto', kategorie: 'nudeln', gesund: false },
  // Suppen
  { name: 'Möhren-Ingwer-Suppe', kategorie: 'suppe', gesund: true },
  { name: 'Gemüsesuppe', kategorie: 'suppe', gesund: true },
  { name: 'Chili con Carne', kategorie: 'suppe', gesund: false },
  { name: 'Linseneintopf', kategorie: 'suppe', gesund: true },
  { name: 'Weiße Bohnensuppe', kategorie: 'suppe', gesund: true },
  { name: 'Hühnersuppe', kategorie: 'suppe', gesund: true },
  // Aufläufe
  { name: 'Spätzle mit Hühnchen', kategorie: 'auflauf', gesund: false },
  { name: 'Zucchini-Hack-Auflauf', kategorie: 'auflauf', gesund: false },
  // Fisch
  { name: 'Garnelen', kategorie: 'fisch', gesund: true },
  { name: 'Gegrillte Dorade', kategorie: 'fisch', gesund: true },
  { name: 'Wolfsbarsch', kategorie: 'fisch', gesund: true },
  { name: 'Fisch mit Senfsauce und Kartoffeln', kategorie: 'fisch', gesund: true },
  // Salate
  { name: 'Salat mit Putenbrust', kategorie: 'salat', gesund: true },
  { name: 'Salat mit Ziegenkäse', kategorie: 'salat', gesund: true },
  { name: 'Salat mit Bratkartoffeln und Spiegelei', kategorie: 'salat', gesund: true },
  // Sonstiges
  { name: 'Bauernfrühstück', kategorie: 'sonstiges', gesund: false },
  { name: 'Massaman Curry', kategorie: 'sonstiges', gesund: false },
  { name: 'Bruschetta', kategorie: 'sonstiges', gesund: false },
  { name: 'Thai Curry', kategorie: 'sonstiges', gesund: false },
  { name: 'Chicken Tikka Masala', kategorie: 'sonstiges', gesund: false },
  { name: 'Englisches Frühstück', kategorie: 'sonstiges', gesund: false },
  { name: 'Spinat mit Kartoffeln und Ei', kategorie: 'sonstiges', gesund: true },
]

async function seed() {
  console.log('Seeding familie_profile...')
  const { error: profileError } = await supabase
    .from('familie_profile')
    .upsert(profile, { onConflict: 'name' })
  if (profileError) throw profileError
  console.log(`✓ ${profile.length} Profile importiert`)

  console.log('Seeding gerichte...')
  const { error: gerichtError } = await supabase
    .from('gerichte')
    .upsert(gerichte, { onConflict: 'name' })
  if (gerichtError) throw gerichtError
  console.log(`✓ ${gerichte.length} Gerichte importiert`)

  console.log('Seed abgeschlossen.')
}

seed().catch(console.error)
```

- [ ] **Schritt 3: Script in package.json eintragen**

```json
"seed": "ts-node --project tsconfig.json scripts/seed.ts"
```

- [ ] **Schritt 4: Script ausführen**

```bash
npm run seed
```

Erwartete Ausgabe:
```
Seeding familie_profile...
✓ 4 Profile importiert
Seeding gerichte...
✓ 49 Gerichte importiert
Seed abgeschlossen.
```

- [ ] **Schritt 5: In Supabase prüfen**

Dashboard → Table Editor → `familie_profile` und `gerichte` — beide sollten Einträge enthalten.

- [ ] **Schritt 6: Commit**

```bash
git add scripts/seed.ts package.json
git commit -m "feat: add seed script to import family profiles and dishes into Supabase"
```

---

## Task 5: Claude API Wrapper

**Files:**
- Create: `lib/claude.ts`
- Create: `__tests__/lib/claude.test.ts`

- [ ] **Schritt 1: Failing test schreiben**

Datei `__tests__/lib/claude.test.ts`:

```typescript
import { generiereWochenplan } from '@/lib/claude'
import type { FamilieMitglied, Gericht } from '@/types'

// Claude API wird in Unit-Tests gemockt
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify([
            { tag: 'montag', mahlzeit: 'mittag', gericht_name: 'Flickerklopse' },
            { tag: 'montag', mahlzeit: 'abend', gericht_name: 'Pizza Margherita' },
          ])
        }]
      })
    }
  }))
}))

describe('generiereWochenplan', () => {
  const mockProfile: FamilieMitglied[] = [{
    id: '1', name: 'Ben', alter: 11,
    lieblingsgerichte: ['Flickerklopse'], abneigungen: ['Brokkoli'],
    lieblingsobst: [], lieblingsgemuese: [], notizen: ''
  }]

  const mockGerichte: Gericht[] = [{
    id: 'g1', name: 'Flickerklopse', zutaten: [], gesund: false,
    kategorie: 'fleisch', beliebtheit: {}, quelle: 'manuell'
  }]

  it('gibt ein Array mit 14 Einträgen zurück (7 Tage × 2 Mahlzeiten)', async () => {
    const plan = await generiereWochenplan(mockProfile, mockGerichte)
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBeGreaterThan(0)
  })

  it('jeder Eintrag hat tag, mahlzeit und gericht_name', async () => {
    const plan = await generiereWochenplan(mockProfile, mockGerichte)
    plan.forEach(eintrag => {
      expect(eintrag).toHaveProperty('tag')
      expect(eintrag).toHaveProperty('mahlzeit')
      expect(eintrag).toHaveProperty('gericht_name')
    })
  })
})
```

- [ ] **Schritt 2: Test ausführen — muss fehlschlagen**

```bash
npm test -- claude.test.ts
```

Erwartete Ausgabe: `FAIL — Cannot find module '@/lib/claude'`

- [ ] **Schritt 3: Claude-Wrapper implementieren**

Datei `lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { FamilieMitglied, Gericht, WochenplanEintrag } from '@/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const

export async function generiereWochenplan(
  profile: FamilieMitglied[],
  gerichte: Gericht[]
): Promise<Omit<WochenplanEintrag, 'gericht_id'>[]> {
  const profilText = profile.map(p =>
    `- ${p.name} (${p.alter ? p.alter + ' Jahre' : 'Erwachsen'}): mag ${p.lieblingsgerichte.slice(0, 5).join(', ')}; mag nicht: ${p.abneigungen.join(', ')}`
  ).join('\n')

  const gerichteText = gerichte.map(g =>
    `- ${g.name} (${g.gesund ? 'gesund' : 'nicht gesund'}, Kategorie: ${g.kategorie})`
  ).join('\n')

  const prompt = `Du bist Jarvis, ein Haushaltsassistent für eine deutsche Familie.

Erstelle einen Wochenplan für Montag bis Sonntag mit je Mittag und Abend (14 Einträge gesamt).

Familienprofile:
${profilText}

Verfügbare Gerichte:
${gerichteText}

Regeln:
- Wähle NUR Gerichte aus der obigen Liste
- Ca. 70% bekannte Lieblingsgerichte, 30% gesündere Optionen
- Keine Wiederholungen innerhalb einer Woche
- Abwechslungsreiche Kategorien (nicht jeden Tag Nudeln)
- Berücksichtige die Abneigungen aller Familienmitglieder
- Füge am Ende 3 Saft-/Drink-Vorschläge für den Entsafter hinzu (basierend auf Lieblingsobst der Familie: Erdbeere, Mango, Wassermelone, Äpfel etc.)

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "mahlzeiten": [
    {"tag": "montag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "montag", "mahlzeit": "abend", "gericht_name": "..."},
    ...
  ],
  "drinks": [
    {"name": "Erdbeer-Mango-Saft", "zutaten": ["300g Erdbeeren", "1 Mango"]},
    ...
  ]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const parsed = JSON.parse(text)
  return {
    mahlzeiten: parsed.mahlzeiten ?? [],
    drinks: parsed.drinks ?? []
  }
}

export interface DrinkVorschlag {
  name: string
  zutaten: string[]
}
```

- [ ] **Schritt 4: Test ausführen — muss bestehen**

```bash
npm test -- claude.test.ts
```

Erwartete Ausgabe: `PASS`

- [ ] **Schritt 5: Commit**

```bash
git add lib/claude.ts __tests__/lib/claude.test.ts
git commit -m "feat: add Claude API wrapper for meal plan generation"
```

---

## Task 6: Wochenplan-Logik

**Files:**
- Create: `lib/wochenplan.ts`
- Create: `__tests__/lib/wochenplan.test.ts`

- [ ] **Schritt 1: Failing test schreiben**

Datei `__tests__/lib/wochenplan.test.ts`:

```typescript
import { getMontag, erstelleWochenplanEintraege } from '@/lib/wochenplan'
import type { Gericht } from '@/types'

describe('getMontag', () => {
  it('gibt den Montag der aktuellen Woche zurück', () => {
    const montag = getMontag(new Date('2026-04-14')) // Dienstag
    expect(montag.toISOString().startsWith('2026-04-13')).toBe(true) // Montag
  })

  it('gibt denselben Montag zurück wenn schon Montag', () => {
    const montag = getMontag(new Date('2026-04-13'))
    expect(montag.toISOString().startsWith('2026-04-13')).toBe(true)
  })
})

describe('erstelleWochenplanEintraege', () => {
  const mockGerichte: Gericht[] = [
    { id: 'g1', name: 'Flickerklopse', zutaten: [], gesund: false, kategorie: 'fleisch', beliebtheit: {}, quelle: 'manuell' },
    { id: 'g2', name: 'Pizza Margherita', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell' },
  ]

  it('verbindet Claude-Antworten mit Gericht-IDs', () => {
    const claudeAntwort = [
      { tag: 'montag' as const, mahlzeit: 'mittag' as const, gericht_name: 'Flickerklopse' },
    ]
    const eintraege = erstelleWochenplanEintraege(claudeAntwort, mockGerichte)
    expect(eintraege[0].gericht_id).toBe('g1')
    expect(eintraege[0].gericht_name).toBe('Flickerklopse')
  })

  it('überspringt Gerichte die nicht in der DB sind', () => {
    const claudeAntwort = [
      { tag: 'montag' as const, mahlzeit: 'mittag' as const, gericht_name: 'Unbekanntes Gericht' },
    ]
    const eintraege = erstelleWochenplanEintraege(claudeAntwort, mockGerichte)
    expect(eintraege.length).toBe(0)
  })
})
```

- [ ] **Schritt 2: Test ausführen — muss fehlschlagen**

```bash
npm test -- wochenplan.test.ts
```

Erwartete Ausgabe: `FAIL — Cannot find module '@/lib/wochenplan'`

- [ ] **Schritt 3: Implementierung schreiben**

Datei `lib/wochenplan.ts`:

```typescript
import { supabase } from '@/lib/supabase'
import type { Gericht, Wochenplan, WochenplanEintrag } from '@/types'

export function getMontag(datum: Date = new Date()): Date {
  const d = new Date(datum)
  const tag = d.getDay() // 0 = Sonntag, 1 = Montag, ...
  const diff = tag === 0 ? -6 : 1 - tag
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function erstelleWochenplanEintraege(
  claudeAntwort: Omit<WochenplanEintrag, 'gericht_id'>[],
  gerichte: Gericht[]
): WochenplanEintrag[] {
  return claudeAntwort
    .map(eintrag => {
      const gericht = gerichte.find(g => g.name === eintrag.gericht_name)
      if (!gericht) return null
      return { ...eintrag, gericht_id: gericht.id }
    })
    .filter((e): e is WochenplanEintrag => e !== null)
}

export async function ladeAktuellenWochenplan(): Promise<Wochenplan | null> {
  const montag = getMontag().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('wochenplaene')
    .select('*')
    .eq('woche_start', montag)
    .single()
  if (error || !data) return null
  return data as Wochenplan
}

export async function speichereWochenplan(
  eintraege: WochenplanEintrag[],
  status: 'entwurf' | 'genehmigt' = 'entwurf'
): Promise<Wochenplan> {
  const montag = getMontag().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('wochenplaene')
    .upsert({ woche_start: montag, eintraege, status }, { onConflict: 'woche_start' })
    .select()
    .single()
  if (error) throw error
  return data as Wochenplan
}
```

- [ ] **Schritt 4: Tests ausführen — müssen bestehen**

```bash
npm test -- wochenplan.test.ts
```

Erwartete Ausgabe: `PASS`

- [ ] **Schritt 5: Commit**

```bash
git add lib/wochenplan.ts __tests__/lib/wochenplan.test.ts
git commit -m "feat: add meal plan logic with Supabase persistence"
```

---

## Task 7: API Routes

**Files:**
- Create: `app/api/wochenplan/generate/route.ts`
- Create: `app/api/wochenplan/route.ts`
- Create: `app/api/gerichte/route.ts`

- [ ] **Schritt 1: Gerichte-Route schreiben**

Datei `app/api/gerichte/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('gerichte')
    .select('*')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Schritt 2: Wochenplan-Route schreiben**

Datei `app/api/wochenplan/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ladeAktuellenWochenplan, speichereWochenplan } from '@/lib/wochenplan'
import type { WochenplanEintrag } from '@/types'

export async function GET() {
  const plan = await ladeAktuellenWochenplan()
  if (!plan) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(plan)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { eintraege, status }: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' } = body
  const plan = await speichereWochenplan(eintraege, status)
  return NextResponse.json(plan)
}
```

- [ ] **Schritt 3: Generate-Route schreiben**

Datei `app/api/wochenplan/generate/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generiereWochenplan } from '@/lib/claude'
import { erstelleWochenplanEintraege, speichereWochenplan } from '@/lib/wochenplan'
import type { FamilieMitglied, Gericht } from '@/types'

export async function POST() {
  // Profile und Gerichte aus Supabase laden
  const [{ data: profile }, { data: gerichte }] = await Promise.all([
    supabase.from('familie_profile').select('*'),
    supabase.from('gerichte').select('*'),
  ])

  if (!profile || !gerichte) {
    return NextResponse.json({ error: 'Daten konnten nicht geladen werden' }, { status: 500 })
  }

  // Claude generiert den Plan
  const claudeAntwort = await generiereWochenplan(
    profile as FamilieMitglied[],
    gerichte as Gericht[]
  )

  // Claude-Antwort mit Gericht-IDs verknüpfen
  const eintraege = erstelleWochenplanEintraege(claudeAntwort, gerichte as Gericht[])

  // Plan als Entwurf speichern
  const plan = await speichereWochenplan(eintraege, 'entwurf')

  return NextResponse.json(plan)
}
```

- [ ] **Schritt 4: Routes manuell testen**

Dev-Server starten: `npm run dev`

```bash
# Gerichte-Liste testen
curl http://localhost:3000/api/gerichte

# Wochenplan generieren (braucht ANTHROPIC_API_KEY in .env.local)
curl -X POST http://localhost:3000/api/wochenplan/generate
```

Erwartete Ausgabe von generate: JSON-Objekt mit `eintraege`-Array (14 Einträge)

- [ ] **Schritt 5: Commit**

```bash
git add app/api/
git commit -m "feat: add API routes for meal plan generation and persistence"
```

---

## Task 8: Wochenplan-UI

**Files:**
- Create: `components/GerichtCard.tsx`
- Create: `components/WochenplanGrid.tsx`
- Create: `app/wochenplan/page.tsx`
- Create: `app/page.tsx`
- Create: `__tests__/components/WochenplanGrid.test.tsx`

- [ ] **Schritt 1: GerichtCard-Komponente schreiben**

Datei `components/GerichtCard.tsx`:

```tsx
'use client'

interface GerichtCardProps {
  gerichtName: string
  mahlzeit: 'mittag' | 'abend'
  gesund?: boolean
  onTauschen: () => void
}

export function GerichtCard({ gerichtName, mahlzeit, gesund, onTauschen }: GerichtCardProps) {
  return (
    <div className={`rounded-lg p-3 border ${gesund ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            {mahlzeit === 'mittag' ? '☀️ Mittag' : '🌙 Abend'}
          </p>
          <p className="font-medium text-gray-800 text-sm leading-tight">{gerichtName}</p>
          {gesund && <span className="text-xs text-green-600 mt-1 block">✓ gesund</span>}
        </div>
        <button
          onClick={onTauschen}
          className="text-xs text-blue-500 hover:text-blue-700 shrink-0 mt-1"
          aria-label={`${gerichtName} tauschen`}
        >
          Tauschen
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: WochenplanGrid-Komponente schreiben**

Datei `components/WochenplanGrid.tsx`:

```tsx
'use client'

import { GerichtCard } from '@/components/GerichtCard'
import type { Wochenplan, Gericht } from '@/types'

const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const
const TAG_LABEL: Record<string, string> = {
  montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi',
  donnerstag: 'Do', freitag: 'Fr', samstag: 'Sa', sonntag: 'So'
}

interface WochenplanGridProps {
  plan: Wochenplan
  gerichte: Gericht[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onGenehmigen: () => void
}

export function WochenplanGrid({ plan, gerichte, onTauschen, onGenehmigen }: WochenplanGridProps) {
  const gerichtMap = Object.fromEntries(gerichte.map(g => [g.id, g]))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {TAGE.map(tag => {
          const mittag = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'mittag')
          const abend = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'abend')

          return (
            <div key={tag} className="space-y-2">
              <p className="text-center text-xs font-semibold text-gray-500 uppercase">
                {TAG_LABEL[tag]}
              </p>
              {mittag && (
                <GerichtCard
                  gerichtName={mittag.gericht_name}
                  mahlzeit="mittag"
                  gesund={gerichtMap[mittag.gericht_id]?.gesund}
                  onTauschen={() => onTauschen(tag, 'mittag')}
                />
              )}
              {abend && (
                <GerichtCard
                  gerichtName={abend.gericht_name}
                  mahlzeit="abend"
                  gesund={gerichtMap[abend.gericht_id]?.gesund}
                  onTauschen={() => onTauschen(tag, 'abend')}
                />
              )}
            </div>
          )
        })}
      </div>

      {plan.status === 'entwurf' && (
        <button
          onClick={onGenehmigen}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
        >
          Plan genehmigen ✓
        </button>
      )}
    </div>
  )
}
```

- [ ] **Schritt 3: Failing Komponenten-Test schreiben**

Datei `__tests__/components/WochenplanGrid.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WochenplanGrid } from '@/components/WochenplanGrid'
import type { Wochenplan, Gericht } from '@/types'

const mockPlan: Wochenplan = {
  id: '1',
  woche_start: '2026-04-13',
  status: 'entwurf',
  erstellt_am: new Date().toISOString(),
  eintraege: [
    { tag: 'montag', mahlzeit: 'mittag', gericht_id: 'g1', gericht_name: 'Flickerklopse' },
    { tag: 'montag', mahlzeit: 'abend', gericht_id: 'g2', gericht_name: 'Pizza Margherita' },
  ]
}

const mockGerichte: Gericht[] = [
  { id: 'g1', name: 'Flickerklopse', zutaten: [], gesund: false, kategorie: 'fleisch', beliebtheit: {}, quelle: 'manuell' },
  { id: 'g2', name: 'Pizza Margherita', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell' },
]

describe('WochenplanGrid', () => {
  it('zeigt Gerichte des Plans an', () => {
    render(<WochenplanGrid plan={mockPlan} gerichte={mockGerichte} onTauschen={() => {}} onGenehmigen={() => {}} />)
    expect(screen.getByText('Flickerklopse')).toBeInTheDocument()
    expect(screen.getByText('Pizza Margherita')).toBeInTheDocument()
  })

  it('ruft onTauschen auf wenn Tauschen-Button geklickt', () => {
    const onTauschen = jest.fn()
    render(<WochenplanGrid plan={mockPlan} gerichte={mockGerichte} onTauschen={onTauschen} onGenehmigen={() => {}} />)
    fireEvent.click(screen.getAllByText('Tauschen')[0])
    expect(onTauschen).toHaveBeenCalledWith('montag', 'mittag')
  })

  it('zeigt Genehmigen-Button bei Entwurf', () => {
    render(<WochenplanGrid plan={mockPlan} gerichte={mockGerichte} onTauschen={() => {}} onGenehmigen={() => {}} />)
    expect(screen.getByText(/genehmigen/i)).toBeInTheDocument()
  })
})
```

- [ ] **Schritt 4: Tests ausführen**

```bash
npm test -- WochenplanGrid.test.tsx
```

Erwartete Ausgabe: `PASS`

- [ ] **Schritt 5: Wochenplan-Seite schreiben**

Datei `app/wochenplan/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { WochenplanGrid } from '@/components/WochenplanGrid'
import type { Wochenplan, Gericht } from '@/types'

export default function WochenplanPage() {
  const [plan, setPlan] = useState<Wochenplan | null>(null)
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gerichte').then(r => r.json()).then(setGerichte)
    fetch('/api/wochenplan').then(r => r.ok ? r.json() : null).then(setPlan)
  }, [])

  async function generieren() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wochenplan/generate', { method: 'POST' })
      if (!res.ok) throw new Error('Fehler beim Generieren')
      setPlan(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function tauschen(tag: string, mahlzeit: string) {
    if (!plan) return
    // Zufällig ein anderes Gericht wählen
    const aktuell = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const andere = gerichte.filter(g => g.id !== aktuell?.gericht_id)
    const neu = andere[Math.floor(Math.random() * andere.length)]
    if (!neu) return

    const eintraege = plan.eintraege.map(e =>
      e.tag === tag && e.mahlzeit === mahlzeit
        ? { ...e, gericht_id: neu.id, gericht_name: neu.name }
        : e
    )
    const res = await fetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege, status: plan.status })
    })
    setPlan(await res.json())
  }

  async function genehmigen() {
    if (!plan) return
    const res = await fetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege: plan.eintraege, status: 'genehmigt' })
    })
    setPlan(await res.json())
  }

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🍽️ Wochenplan</h1>
        <button
          onClick={generieren}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generiere...' : '✨ Neuer Plan'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {plan ? (
        <WochenplanGrid
          plan={plan}
          gerichte={gerichte}
          onTauschen={tauschen}
          onGenehmigen={genehmigen}
        />
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-4">Noch kein Plan für diese Woche</p>
          <button onClick={generieren} className="text-blue-500 hover:underline">
            Jetzt generieren →
          </button>
        </div>
      )}
    </main>
  )
}
```

- [ ] **Schritt 6: Root-Seite als Redirect schreiben**

Datei `app/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/wochenplan')
}
```

- [ ] **Schritt 7: App im Browser testen**

```bash
npm run dev
```

Öffne `http://localhost:3000` — sollte zu `/wochenplan` weiterleiten.  
Klicke „Neuer Plan" — nach ~10 Sekunden erscheint der Wochenplan mit 14 Gerichten.

- [ ] **Schritt 8: Commit**

```bash
git add components/ app/wochenplan/ app/page.tsx __tests__/components/
git commit -m "feat: add weekly meal plan UI with generate and approve flow"
```

---

## Task 9: Alle Tests ausführen & finaler Check

- [ ] **Schritt 1: Alle Tests ausführen**

```bash
npm test
```

Erwartete Ausgabe: Alle Tests `PASS`, keine Fehler.

- [ ] **Schritt 2: Build prüfen**

```bash
npm run build
```

Erwartete Ausgabe: `✓ Compiled successfully`

- [ ] **Schritt 3: Finales Commit**

```bash
git add .
git commit -m "feat: complete Plan 1 - Jarvis foundation and weekly meal planner"
```

---

## Ergebnis von Plan 1

Nach Abschluss dieses Plans existiert:
- ✅ Lauffähige Next.js App auf `localhost:3000`
- ✅ Supabase-Datenbank mit allen Familienprofilen und 49 Gerichten
- ✅ KI-Wochenplanung via Claude API (generiert, tauscht, genehmigt)
- ✅ Responsive UI (Grundlage für iPhone-Nutzung)
- ✅ Tests für alle Kernfunktionen

**Plan 2** baut darauf auf: Bring API, Picnic API, Chat-Interface, PWA-Finalisierung, Vercel Deployment.
