# Bring API Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatisch eine strukturierte Einkaufsliste aus dem Wochenplan generieren und in zwei Bring-Listen übertragen (Einkauf 1 für Wochenanfang, Einkauf 2 für Wochenende), aufgeteilt nach Haltbarkeit der Zutaten.

**Architecture:** Zutaten werden strukturiert als JSONB pro Gericht in Supabase gespeichert (einmalig per Claude generiert, dann von Katja überprüfbar). Eine Splitting-Funktion teilt die Einkaufsliste anhand von Einkaufstagen (aus `.env.local`) auf. Zwei Bring-Listen werden per `bring-shopping` npm-Paket aktualisiert.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (JSONB), Anthropic Claude API, bring-shopping (npm), Jest

---

## Dateistruktur

```
Neue Dateien:
  app/supabase/migration_zutaten_jsonb.sql     DB: text[] → jsonb Migration
  app/supabase/migration_einstellungen.sql     DB: einstellungen Tabelle (Einkaufstage)
  app/lib/einkaufsliste.ts                     Splitting-Logik (pure functions, testbar)
  app/lib/bring.ts                             Bring API Wrapper
  app/app/api/zutaten/generieren/route.ts      Claude generiert Zutaten für alle Gerichte
  app/app/api/einkaufsliste/senden/route.ts    Generiert Listen + sendet an Bring
  app/app/gerichte/page.tsx                    UI: Zutaten anzeigen & bearbeiten
  app/__tests__/lib/einkaufsliste.test.ts      Tests für Splitting-Logik

Geänderte Dateien:
  app/types/index.ts                           Gericht.zutaten: string[] → Zutat[]
  app/app/wochenplan/page.tsx                  "Einkaufsliste" Button + "Gerichte" Link
  app/.env.local                               BRING_EMAIL, BRING_PASSWORD, EINKAUFSTAG_1, EINKAUFSTAG_2
```

---

### Task 1: DB-Migrationen vorbereiten und ausführen

**Files:**
- Create: `app/supabase/migration_zutaten_jsonb.sql`
- Create: `app/supabase/migration_einstellungen.sql`

- [ ] **Step 1: SQL-Datei für JSONB-Migration erstellen**

Erstelle `app/supabase/migration_zutaten_jsonb.sql`:

```sql
-- Ändert zutaten von text[] zu jsonb
-- Bestehende leere Arrays {} werden zu einem leeren JSON-Array []
ALTER TABLE gerichte
  ALTER COLUMN zutaten TYPE jsonb
  USING CASE
    WHEN zutaten IS NULL OR array_length(zutaten, 1) IS NULL THEN '[]'::jsonb
    ELSE to_jsonb(zutaten)
  END;

-- Standardwert anpassen
ALTER TABLE gerichte ALTER COLUMN zutaten SET DEFAULT '[]'::jsonb;
```

- [ ] **Step 2: SQL-Datei für Einstellungen-Tabelle erstellen**

Erstelle `app/supabase/migration_einstellungen.sql`:

```sql
CREATE TABLE IF NOT EXISTS einstellungen (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Standardwerte: Montag (1) und Donnerstag (4)
-- Skala: 1=Montag, 2=Dienstag, 3=Mittwoch, 4=Donnerstag, 5=Freitag, 6=Samstag, 7=Sonntag
INSERT INTO einstellungen (key, value) VALUES ('einkaufstag_1', '1') ON CONFLICT DO NOTHING;
INSERT INTO einstellungen (key, value) VALUES ('einkaufstag_2', '4') ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Migrationen im Supabase Dashboard ausführen**

1. Öffne https://supabase.com → Projekt → SQL Editor
2. Führe den Inhalt von `migration_zutaten_jsonb.sql` aus
3. Prüfe: "Success. No rows returned"
4. Führe den Inhalt von `migration_einstellungen.sql` aus
5. Prüfe: "Success. No rows returned"

- [ ] **Step 4: Commit**

```bash
git add app/supabase/migration_zutaten_jsonb.sql app/supabase/migration_einstellungen.sql
git commit -m "feat: add DB migrations for jsonb zutaten and einstellungen table"
```

---

### Task 2: TypeScript-Typen aktualisieren + bring-shopping installieren

**Files:**
- Modify: `app/types/index.ts`
- Modify: `app/package.json` (via npm install)

- [ ] **Step 1: bring-shopping installieren**

```bash
cd app && npm install bring-shopping
```

Erwartete Ausgabe: `added 1 package` (o.ä.)

- [ ] **Step 2: Typen in `app/types/index.ts` aktualisieren**

Ersetze die gesamte Datei mit:

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

export interface Zutat {
  name: string
  menge: number
  einheit: string       // 'g' | 'ml' | 'Stück' | 'EL' | 'TL' | 'Bund' | 'Packung' | 'kg' | 'l'
  haltbarkeit_tage: number  // wie viele Tage die Zutat im Kühlschrank hält
}

export interface Gericht {
  id: string
  name: string
  zutaten: Zutat[]     // war: string[] — jetzt strukturiert
  gesund: boolean
  kategorie: Kategorie
  beliebtheit: Record<string, number>
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
  woche_start: string
  eintraege: WochenplanEintrag[]
  status: 'entwurf' | 'genehmigt'
  erstellt_am: string
}

export interface EinkaufsItem {
  name: string
  menge: number
  einheit: string
}

export interface EinkaufslistenErgebnis {
  einkauf1: EinkaufsItem[]
  einkauf2: EinkaufsItem[]
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

export interface DrinkVorschlag {
  name: string
  zutaten: string[]
}
```

- [ ] **Step 3: TypeScript-Kompilierung prüfen**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler (oder nur Warnungen, keine Errors)

- [ ] **Step 4: Tests ausführen um Regressionen zu prüfen**

```bash
cd app && npm test
```

Erwartete Ausgabe: alle 16 Tests grün

- [ ] **Step 5: Commit**

```bash
git add app/types/index.ts app/package.json app/package-lock.json
git commit -m "feat: add Zutat type, update Gericht.zutaten to Zutat[], install bring-shopping"
```

---

### Task 3: Einkaufsliste-Splitting-Logik (`lib/einkaufsliste.ts`)

**Files:**
- Create: `app/lib/einkaufsliste.ts`
- Create: `app/__tests__/lib/einkaufsliste.test.ts`

- [ ] **Step 1: Testdatei schreiben**

Erstelle `app/__tests__/lib/einkaufsliste.test.ts`:

```typescript
import {
  generiereEinkaufslisten,
  tagZuWochenindex,
  aggregiere,
} from '@/lib/einkaufsliste'
import type { Gericht, WochenplanEintrag, Zutat } from '@/types'

const hackfleisch: Zutat = { name: 'Hackfleisch', menge: 500, einheit: 'g', haltbarkeit_tage: 2 }
const nudeln: Zutat = { name: 'Nudeln', menge: 400, einheit: 'g', haltbarkeit_tage: 365 }
const zwiebeln: Zutat = { name: 'Zwiebeln', menge: 2, einheit: 'Stück', haltbarkeit_tage: 14 }

const bolognese: Gericht = {
  id: 'g1', name: 'Spaghetti Bolognese', gesund: false, kategorie: 'nudeln',
  beliebtheit: {}, quelle: 'manuell',
  zutaten: [hackfleisch, nudeln, zwiebeln]
}

const chickenWings: Gericht = {
  id: 'g2', name: 'Chicken Wings mit Pommes', gesund: false, kategorie: 'fleisch',
  beliebtheit: {}, quelle: 'manuell',
  zutaten: [
    { name: 'Chicken Wings', menge: 1000, einheit: 'g', haltbarkeit_tage: 2 },
    { name: 'Pommes', menge: 500, einheit: 'g', haltbarkeit_tage: 30 }
  ]
}

describe('tagZuWochenindex', () => {
  it('gibt 1 für montag zurück', () => expect(tagZuWochenindex('montag')).toBe(1))
  it('gibt 7 für sonntag zurück', () => expect(tagZuWochenindex('sonntag')).toBe(7))
  it('gibt 4 für donnerstag zurück', () => expect(tagZuWochenindex('donnerstag')).toBe(4))
})

describe('aggregiere', () => {
  it('summiert gleiche Zutaten mit gleicher Einheit', () => {
    const items = [
      { name: 'Hackfleisch', menge: 500, einheit: 'g' },
      { name: 'Hackfleisch', menge: 300, einheit: 'g' },
    ]
    const result = aggregiere(items)
    expect(result).toHaveLength(1)
    expect(result[0].menge).toBe(800)
  })

  it('trennt Zutaten mit unterschiedlichen Einheiten', () => {
    const items = [
      { name: 'Milch', menge: 500, einheit: 'ml' },
      { name: 'Milch', menge: 1, einheit: 'l' },
    ]
    const result = aggregiere(items)
    expect(result).toHaveLength(2)
  })
})

describe('generiereEinkaufslisten', () => {
  const einkaufstag2 = 4 // Donnerstag

  it('legt langlebige Zutaten (>=5 Tage) immer in Einkauf 1', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'samstag', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese], einkaufstag2)
    expect(einkauf1.find(i => i.name === 'Nudeln')).toBeTruthy()    // hält 365 Tage
    expect(einkauf1.find(i => i.name === 'Zwiebeln')).toBeTruthy()  // hält 14 Tage
    expect(einkauf2.find(i => i.name === 'Nudeln')).toBeUndefined()
  })

  it('legt kurzlebige Zutaten in Einkauf 1 wenn Gericht vor Einkaufstag 2', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese], einkaufstag2)
    expect(einkauf1.find(i => i.name === 'Hackfleisch')).toBeTruthy() // Mi(3) < Do(4)
    expect(einkauf2.find(i => i.name === 'Hackfleisch')).toBeUndefined()
  })

  it('legt kurzlebige Zutaten in Einkauf 2 wenn Gericht ab Einkaufstag 2', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'freitag', mahlzeit: 'abend', gericht_id: 'g2', gericht_name: 'Chicken Wings mit Pommes' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [chickenWings], einkaufstag2)
    expect(einkauf2.find(i => i.name === 'Chicken Wings')).toBeTruthy() // Fr(5) >= Do(4)
    expect(einkauf1.find(i => i.name === 'Pommes')).toBeTruthy()        // hält 30 Tage → Einkauf 1
  })

  it('überspringt Reste-Einträge', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' },
      { tag: 'donnerstag', mahlzeit: 'mittag', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese (Reste)' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese], einkaufstag2)
    const hackfleischE1 = einkauf1.find(i => i.name === 'Hackfleisch')
    // Basis-Gericht (Mi) hat Reste → Menge verdoppelt (500g × 2 = 1000g)
    expect(hackfleischE1?.menge).toBe(1000)
    // Nudeln (langlebig) ebenfalls verdoppelt
    expect(einkauf1.find(i => i.name === 'Nudeln')?.menge).toBe(800)
  })

  it('aggregiert gleiche kurzlebige Zutat die in beiden Hälften vorkommt in getrennte Listen', () => {
    // Bolognese Mi + Chicken Wings Fr — beide brauchen kurzlebige Fleischzutaten
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' },
      { tag: 'freitag', mahlzeit: 'abend', gericht_id: 'g2', gericht_name: 'Chicken Wings mit Pommes' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese, chickenWings], einkaufstag2)
    expect(einkauf1.find(i => i.name === 'Hackfleisch')).toBeTruthy()     // Mi → Einkauf 1
    expect(einkauf2.find(i => i.name === 'Chicken Wings')).toBeTruthy()   // Fr → Einkauf 2
  })

  it('gibt leere Listen zurück wenn kein Wochenplan', () => {
    const { einkauf1, einkauf2 } = generiereEinkaufslisten([], [bolognese], einkaufstag2)
    expect(einkauf1).toHaveLength(0)
    expect(einkauf2).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

```bash
cd app && npm test -- --testPathPattern=einkaufsliste
```

Erwartete Ausgabe: FAIL — "Cannot find module '@/lib/einkaufsliste'"

- [ ] **Step 3: `lib/einkaufsliste.ts` implementieren**

Erstelle `app/lib/einkaufsliste.ts`:

```typescript
import type { Gericht, WochenplanEintrag, EinkaufsItem, EinkaufslistenErgebnis } from '@/types'

// Wochenindex: 1=Montag, 2=Dienstag, ..., 6=Samstag, 7=Sonntag
const TAG_INDEX: Record<string, number> = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4,
  freitag: 5, samstag: 6, sonntag: 7
}

export function tagZuWochenindex(tag: string): number {
  return TAG_INDEX[tag] ?? 0
}

export function aggregiere(items: EinkaufsItem[]): EinkaufsItem[] {
  const map = new Map<string, EinkaufsItem>()
  for (const item of items) {
    const key = `${item.name.toLowerCase()}|${item.einheit.toLowerCase()}`
    const existing = map.get(key)
    if (existing) {
      existing.menge += item.menge
    } else {
      map.set(key, { ...item })
    }
  }
  return Array.from(map.values())
}

function istReste(gerichtName: string): boolean {
  return gerichtName.includes('(Reste)')
}

function basisName(name: string): string {
  return name.replace(/\s*\(Reste\)\s*$/, '').trim()
}

export function generiereEinkaufslisten(
  eintraege: WochenplanEintrag[],
  gerichte: Gericht[],
  einkaufstag2: number  // 1=Mo...7=So — ab diesem Tag gehören kurzlebige Zutaten in Einkauf 2
): EinkaufslistenErgebnis {
  const gerichtMap = new Map(gerichte.map(g => [g.name, g]))

  // Reste-Namen ermitteln (welche Basisgerichte haben Reste diese Woche)
  const gerichteNamenMitResten = new Set(
    eintraege
      .filter(e => istReste(e.gericht_name))
      .map(e => basisName(e.gericht_name))
  )

  // Nur Nicht-Reste-Einträge verarbeiten
  const relevantEintraege = eintraege.filter(e => !istReste(e.gericht_name))

  const roh1: EinkaufsItem[] = []
  const roh2: EinkaufsItem[] = []

  for (const eintrag of relevantEintraege) {
    const gericht = gerichtMap.get(eintrag.gericht_name)
    if (!gericht || gericht.zutaten.length === 0) continue

    const tagIndex = tagZuWochenindex(eintrag.tag)
    const hatReste = gerichteNamenMitResten.has(eintrag.gericht_name)
    const faktor = hatReste ? 2 : 1

    for (const zutat of gericht.zutaten) {
      const item: EinkaufsItem = {
        name: zutat.name,
        menge: zutat.menge * faktor,
        einheit: zutat.einheit,
      }

      // Langlebige Zutaten (>= 5 Tage) immer in Einkauf 1
      if (zutat.haltbarkeit_tage >= 5) {
        roh1.push(item)
      } else if (tagIndex < einkaufstag2) {
        roh1.push(item)
      } else {
        roh2.push(item)
      }
    }
  }

  return {
    einkauf1: aggregiere(roh1),
    einkauf2: aggregiere(roh2),
  }
}
```

- [ ] **Step 4: Tests ausführen — müssen grün sein**

```bash
cd app && npm test -- --testPathPattern=einkaufsliste
```

Erwartete Ausgabe: PASS — alle 8 Tests grün

- [ ] **Step 5: Alle Tests ausführen — keine Regressionen**

```bash
cd app && npm test
```

Erwartete Ausgabe: alle Tests grün (16 + 8 = 24 gesamt)

- [ ] **Step 6: Commit**

```bash
git add app/lib/einkaufsliste.ts app/__tests__/lib/einkaufsliste.test.ts
git commit -m "feat: add einkaufsliste splitting logic with Reste handling and aggregation"
```

---

### Task 4: Bring API Wrapper (`lib/bring.ts`)

**Files:**
- Create: `app/lib/bring.ts`

**Hinweis:** `bring-shopping` ist ein Community-Paket für die inoffizielle Bring-API. Die Methoden können sich ändern. Falls das Paket breaking changes hat, prüfe die aktuelle README auf npm.

- [ ] **Step 1: `.env.local` erweitern**

Öffne `app/.env.local` und füge hinzu:

```
BRING_EMAIL=deine-bring-email@example.com
BRING_PASSWORD=dein-bring-passwort
BRING_LIST_NAME_1=Jarvis — Einkauf 1
BRING_LIST_NAME_2=Jarvis — Einkauf 2
EINKAUFSTAG_1=1
EINKAUFSTAG_2=4
```

Trage die echten Bring-Login-Daten (von Katja) ein.

Die beiden Listen "Jarvis — Einkauf 1" und "Jarvis — Einkauf 2" müssen **manuell in der Bring-App erstellt werden** bevor der Code laufen kann.

- [ ] **Step 2: `lib/bring.ts` erstellen**

Erstelle `app/lib/bring.ts`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BringLib = require('bring-shopping')

interface BringListEntry {
  listUuid: string
  name: string
}

interface BringItem {
  name: string
  specification: string
}

interface BringInstance {
  login(email: string, password: string): Promise<void>
  getLists(): Promise<{ lists: BringListEntry[] }>
  getItems(listUuid: string): Promise<{ purchase: BringItem[]; recently: BringItem[] }>
  saveItem(listUuid: string, itemName: string, specification: string): Promise<void>
  removeItem(listUuid: string, itemName: string): Promise<void>
}

let client: BringInstance | null = null

async function getClient(): Promise<BringInstance> {
  if (client) return client
  const bring: BringInstance = new BringLib()
  await bring.login(
    process.env.BRING_EMAIL!,
    process.env.BRING_PASSWORD!
  )
  client = bring
  return client
}

async function findeListeUuid(bring: BringInstance, listenName: string): Promise<string> {
  const { lists } = await bring.getLists()
  const liste = lists.find(l => l.name === listenName)
  if (!liste) {
    throw new Error(
      `Bring-Liste "${listenName}" nicht gefunden. Bitte erstelle sie manuell in der Bring-App.`
    )
  }
  return liste.listUuid
}

export async function aktualisiereEinkaufsliste(
  listenName: string,
  items: { name: string; menge: number; einheit: string }[]
): Promise<void> {
  const bring = await getClient()
  const listUuid = await findeListeUuid(bring, listenName)

  // Bestehende Items aus der Liste holen und entfernen
  const { purchase } = await bring.getItems(listUuid)
  for (const item of purchase) {
    await bring.removeItem(listUuid, item.name)
  }

  // Neue Items hinzufügen
  for (const item of items) {
    const spec = `${item.menge}${item.einheit}`
    await bring.saveItem(listUuid, item.name, spec)
  }
}
```

- [ ] **Step 3: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine neuen Fehler

- [ ] **Step 4: Commit**

```bash
git add app/lib/bring.ts app/.env.local
git commit -m "feat: add Bring API wrapper with login, list lookup, and item sync"
```

---

### Task 5: Claude Zutaten-Generierungs-API (`app/api/zutaten/generieren/route.ts`)

**Files:**
- Create: `app/app/api/zutaten/generieren/route.ts`

- [ ] **Step 1: API-Route erstellen**

Erstelle `app/app/api/zutaten/generieren/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import type { Gericht, Zutat } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  // Optional: einzelnes Gericht neu generieren via { gerichtId: '...' }
  const { gerichtId } = body as { gerichtId?: string }

  const query = supabase.from('gerichte').select('id, name')
  if (gerichtId) query.eq('id', gerichtId)

  const { data: gerichte, error } = await query.order('name')
  if (error || !gerichte) {
    return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
  }

  const gerichtListe = (gerichte as Pick<Gericht, 'id' | 'name'>[])
    .map(g => `- ${g.name}`)
    .join('\n')

  const prompt = `Erstelle für jedes der folgenden Gerichte eine strukturierte Zutatenliste.
Basis: 4 Personen (2 Erwachsene, 2 Kinder zwischen 8-11 Jahren), 1 Mahlzeit.

Für jede Zutat:
- name: Zutat-Name auf Deutsch
- menge: Zahl (kein Text)
- einheit: einer von: "g", "kg", "ml", "l", "Stück", "EL", "TL", "Bund", "Packung"
- haltbarkeit_tage: wie viele Tage hält die Zutat im Kühlschrank (z.B. Hackfleisch=2, Nudeln=365, Milch=7, Zwiebeln=14, Karotten=10)

Gerichte:
${gerichtListe}

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "gerichte": [
    {
      "name": "...",
      "zutaten": [
        { "name": "...", "menge": 0, "einheit": "...", "haltbarkeit_tage": 0 }
      ]
    }
  ]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(text) as { gerichte: Array<{ name: string; zutaten: Zutat[] }> }

  // Alle Gerichte in Supabase aktualisieren
  const updates = parsed.gerichte.map(async (g) => {
    const gericht = (gerichte as Pick<Gericht, 'id' | 'name'>[]).find(dbG => dbG.name === g.name)
    if (!gericht) return
    return supabase
      .from('gerichte')
      .update({ zutaten: g.zutaten })
      .eq('id', gericht.id)
  })

  await Promise.all(updates)

  return NextResponse.json({ aktualisiert: parsed.gerichte.length })
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine neuen Fehler

- [ ] **Step 3: Commit**

```bash
git add app/app/api/zutaten/generieren/route.ts
git commit -m "feat: add Claude zutaten generation API route for all dishes"
```

---

### Task 6: Einkaufsliste senden API (`app/api/einkaufsliste/senden/route.ts`)

**Files:**
- Create: `app/app/api/einkaufsliste/senden/route.ts`

- [ ] **Step 1: API-Route erstellen**

Erstelle `app/app/api/einkaufsliste/senden/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generiereEinkaufslisten } from '@/lib/einkaufsliste'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { ladeAktuellenWochenplan } from '@/lib/wochenplan'
import type { Gericht } from '@/types'

export async function POST() {
  // Aktuellen Wochenplan laden
  const plan = await ladeAktuellenWochenplan()
  if (!plan) {
    return NextResponse.json(
      { error: 'Kein Wochenplan für diese Woche gefunden' },
      { status: 404 }
    )
  }

  // Alle Gerichte mit Zutaten laden
  const { data: gerichte, error } = await supabase
    .from('gerichte')
    .select('*')
  if (error || !gerichte) {
    return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
  }

  // Einkaufstage aus Env (Standard: Mo=1, Do=4)
  const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)

  // Einkaufslisten generieren
  const { einkauf1, einkauf2 } = generiereEinkaufslisten(
    plan.eintraege,
    gerichte as Gericht[],
    einkaufstag2
  )

  const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
  const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'

  // Beide Listen gleichzeitig zu Bring senden
  await Promise.all([
    aktualisiereEinkaufsliste(listName1, einkauf1),
    aktualisiereEinkaufsliste(listName2, einkauf2),
  ])

  return NextResponse.json({
    einkauf1Count: einkauf1.length,
    einkauf2Count: einkauf2.length,
  })
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine neuen Fehler

- [ ] **Step 3: Commit**

```bash
git add app/app/api/einkaufsliste/senden/route.ts
git commit -m "feat: add einkaufsliste/senden API route combining plan, splitting logic, and Bring"
```

---

### Task 7: Gerichte-Verwaltungsseite (`app/gerichte/page.tsx`)

**Files:**
- Create: `app/app/gerichte/page.tsx`

- [ ] **Step 1: Seite erstellen**

Erstelle `app/app/gerichte/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { Gericht, Zutat } from '@/types'

export default function GerichtePage() {
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null)
  const [bearbeiteZutaten, setBearbeiteZutaten] = useState<Zutat[]>([])
  const [generiere, setGeneriere] = useState(false)
  const [speichere, setSpeichere] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gerichte').then(r => r.json()).then(setGerichte)
  }, [])

  async function alleZutatenGenerieren() {
    setGeneriere(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/zutaten/generieren', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setMeldung(`✅ ${data.aktualisiert} Gerichte aktualisiert`)
      const updated = await fetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setGeneriere(false)
    }
  }

  async function einzelnGenerieren(gericht: Gericht) {
    setMeldung(null)
    try {
      const res = await fetch('/api/zutaten/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: gericht.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setMeldung(`✅ ${gericht.name} aktualisiert`)
      const updated = await fetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    }
  }

  function bearbeiteStart(gericht: Gericht) {
    setBearbeiteId(gericht.id)
    setBearbeiteZutaten([...gericht.zutaten])
  }

  function zutatAendern(index: number, feld: keyof Zutat, wert: string | number) {
    setBearbeiteZutaten(prev => prev.map((z, i) =>
      i === index ? { ...z, [feld]: wert } : z
    ))
  }

  function zutatHinzufuegen() {
    setBearbeiteZutaten(prev => [
      ...prev,
      { name: '', menge: 0, einheit: 'g', haltbarkeit_tage: 1 }
    ])
  }

  function zutatEntfernen(index: number) {
    setBearbeiteZutaten(prev => prev.filter((_, i) => i !== index))
  }

  async function speichern(gerichtId: string) {
    setSpeichere(true)
    try {
      const res = await fetch('/api/gerichte/' + gerichtId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zutaten: bearbeiteZutaten })
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      const updated = await fetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setBearbeiteId(null)
      setMeldung('✅ Gespeichert')
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setSpeichere(false)
    }
  }

  const ohneZutaten = gerichte.filter(g => g.zutaten.length === 0).length

  return (
    <main className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🥘 Gerichte & Zutaten</h1>
          {ohneZutaten > 0 && (
            <p className="text-sm text-amber-600 mt-1">
              ⚠️ {ohneZutaten} Gerichte haben noch keine Zutaten
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href="/wochenplan"
            className="text-gray-600 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Wochenplan
          </a>
          <button
            onClick={alleZutatenGenerieren}
            disabled={generiere}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {generiere ? 'Generiere...' : '✨ Alle Zutaten generieren'}
          </button>
        </div>
      </div>

      {meldung && (
        <p className="text-sm mb-4 p-3 bg-gray-50 rounded-lg">{meldung}</p>
      )}

      <div className="space-y-3">
        {gerichte.map(gericht => (
          <div key={gericht.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-medium text-gray-900">{gericht.name}</h2>
                {bearbeiteId !== gericht.id && (
                  <p className="text-sm text-gray-500 mt-1">
                    {gericht.zutaten.length === 0
                      ? 'Keine Zutaten'
                      : gericht.zutaten.map(z => `${z.menge}${z.einheit} ${z.name}`).join(', ')}
                  </p>
                )}
              </div>
              {bearbeiteId !== gericht.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => einzelnGenerieren(gericht)}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    neu generieren
                  </button>
                  <button
                    onClick={() => bearbeiteStart(gericht)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    ✏️ bearbeiten
                  </button>
                </div>
              )}
            </div>

            {bearbeiteId === gericht.id && (
              <div className="mt-3 space-y-2">
                {bearbeiteZutaten.map((zutat, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={zutat.name}
                      onChange={e => zutatAendern(i, 'name', e.target.value)}
                      placeholder="Name"
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                    />
                    <input
                      type="number"
                      value={zutat.menge}
                      onChange={e => zutatAendern(i, 'menge', parseFloat(e.target.value))}
                      className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                    />
                    <select
                      value={zutat.einheit}
                      onChange={e => zutatAendern(i, 'einheit', e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      {['g', 'kg', 'ml', 'l', 'Stück', 'EL', 'TL', 'Bund', 'Packung'].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={zutat.haltbarkeit_tage}
                      onChange={e => zutatAendern(i, 'haltbarkeit_tage', parseInt(e.target.value))}
                      title="Haltbarkeit in Tagen"
                      className="w-16 text-sm border border-gray-300 rounded px-2 py-1"
                    />
                    <span className="text-xs text-gray-400">Tage</span>
                    <button
                      onClick={() => zutatEntfernen(i)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={zutatHinzufuegen}
                    className="text-sm text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 rounded px-3 py-1"
                  >
                    + Zutat hinzufügen
                  </button>
                  <button
                    onClick={() => speichern(gericht.id)}
                    disabled={speichere}
                    className="text-sm bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {speichere ? 'Speichere...' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => setBearbeiteId(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: PATCH-Route für Gerichte erstellen**

Erstelle `app/app/api/gerichte/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Zutat } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { zutaten: Zutat[] }

  const { data, error } = await supabase
    .from('gerichte')
    .update({ zutaten: body.zutaten })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine neuen Fehler

- [ ] **Step 4: Commit**

```bash
git add app/app/gerichte/page.tsx app/app/api/gerichte/[id]/route.ts
git commit -m "feat: add gerichte management page with zutaten editing and single-dish regeneration"
```

---

### Task 8: Wochenplan-Seite — Einkaufsliste Button und Navigation

**Files:**
- Modify: `app/app/wochenplan/page.tsx`

- [ ] **Step 1: State und Handler für Einkaufsliste hinzufügen**

Füge in `app/app/wochenplan/page.tsx` folgenden State nach den bestehenden States hinzu (nach `setError`):

```typescript
const [einkaufLoading, setEinkaufLoading] = useState(false)
const [einkaufMeldung, setEinkaufMeldung] = useState<string | null>(null)
```

Und diese Funktion nach der `genehmigen`-Funktion:

```typescript
async function einkaufslisteSenden() {
  setEinkaufLoading(true)
  setEinkaufMeldung(null)
  try {
    const res = await fetch('/api/einkaufsliste/senden', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Fehler')
    setEinkaufMeldung(
      `✅ Einkauf 1 (${data.einkauf1Count} Artikel) und Einkauf 2 (${data.einkauf2Count} Artikel) wurden in Bring aktualisiert`
    )
  } catch (e: unknown) {
    setEinkaufMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
  } finally {
    setEinkaufLoading(false)
  }
}
```

- [ ] **Step 2: UI-Elemente hinzufügen**

Ersetze die `<main>`-Zeile und Header-Sektion (Zeilen 66-76 im Original) mit:

```tsx
<main className="p-4 max-w-6xl mx-auto">
  <div className="flex justify-between items-center mb-6">
    <h1 className="text-2xl font-bold text-gray-900">🍽️ Wochenplan</h1>
    <div className="flex gap-2">
      <a
        href="/gerichte"
        className="text-gray-600 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        🥘 Gerichte
      </a>
      <button
        onClick={generieren}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Generiere...' : '✨ Neuer Plan'}
      </button>
    </div>
  </div>
```

Und füge nach dem `{error && ...}` Block und **nach dem `WochenplanGrid`** (nach Zeile 87 im Original, innerhalb des `plan ? (...)` Blocks) folgenden Block ein:

```tsx
<div className="mt-6 border-t border-gray-100 pt-6">
  <button
    onClick={einkaufslisteSenden}
    disabled={einkaufLoading || !plan}
    className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
  >
    {einkaufLoading ? 'Sende...' : '🛒 Einkaufslisten in Bring übertragen'}
  </button>
  {einkaufMeldung && (
    <p className="text-sm mt-2 text-gray-600">{einkaufMeldung}</p>
  )}
</div>
```

- [ ] **Step 3: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 4: Dev-Server starten und manuell testen**

```bash
cd app && npm run dev
```

Prüfe im Browser (http://localhost:3000):
1. Header zeigt "🥘 Gerichte" Link — klicken, Gerichte-Seite öffnet sich ✓
2. "✨ Alle Zutaten generieren" Button vorhanden ✓
3. Zurück zur Wochenplan-Seite: "🛒 Einkaufslisten in Bring übertragen" Button sichtbar ✓
4. Wenn kein Plan: Button disabled ✓

- [ ] **Step 5: Alle Tests ausführen**

```bash
cd app && npm test
```

Erwartete Ausgabe: alle Tests grün

- [ ] **Step 6: Finaler Commit**

```bash
git add app/app/wochenplan/page.tsx
git commit -m "feat: add Bring shopping list button and Gerichte navigation to Wochenplan page"
```

---

## End-to-End Test (manuell nach allen Tasks)

1. Öffne http://localhost:3000/gerichte
2. Klicke "✨ Alle Zutaten generieren" — warte ca. 30-60 Sekunden
3. Prüfe: Gerichte zeigen jetzt Zutaten an
4. Bearbeite eine Zutat manuell → speichern → Änderung bleibt
5. Öffne http://localhost:3000/wochenplan
6. Falls kein Plan: "✨ Neuer Plan" klicken
7. Klicke "🛒 Einkaufslisten in Bring übertragen"
8. Prüfe Bring-App: beide Listen "Jarvis — Einkauf 1" und "Jarvis — Einkauf 2" haben Artikel
