# Einkaufslisten-Logik-Redesign — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einkaufsliste wird ein persistentes, lebenszyklus-bewusstes Objekt. Nach dem ersten Senden werden bereits abgeschlossene Sektionen (Picnic nach Bestellung, Bring nach Einkaufstag) bei Plan-Änderungen nicht mehr überschrieben — nur noch offene Sektionen per Diff aktualisiert.

**Architecture:** Supabase-Tabelle `einkaufslisten` hält pro Wochenplan genau eine Zeile mit allen drei Sektionen (picnic/bring1/bring2), einem Gestrichen-Array und dem Send-Snapshot. Einfrier-Status wird zur Laufzeit aus Wochentag + Picnic-Bestellstatus berechnet (keine Cron-Jobs). Wochenplan-PUT-Handler triggert je nach State: Liste berechnen (bei Genehmigen), Liste neu berechnen (bei Tausch vor Senden) oder Diff-Update gegen Snapshot (bei Tausch nach Senden).

**Tech Stack:** Next.js App Router (15), TypeScript, Supabase (PostgreSQL), Jest, Tailwind CSS, bring-shopping, picnic-api

**Referenz-Spec:** `docs/superpowers/specs/2026-04-24-einkaufsliste-logik-redesign-design.md`

---

## Dateistruktur

**Neu erstellen:**
- `app/supabase/migration_einkaufsliste_v2.sql` — Schema-Erweiterung
- `app/lib/einkaufsliste-diff.ts` — Einfrier-Status, Diff-Berechnung, Gleichheit
- `app/lib/einkaufsliste-persistence.ts` — DB-Layer (lade/speichere/sync_fehler)
- `app/lib/einkaufsliste-berechnen.ts` — Wrapper um `generiereEinkaufslisten` inkl. Picnic-Routing + Gestrichen-Filter
- `app/app/api/einkaufsliste/route.ts` — GET-Endpoint
- `app/app/api/einkaufsliste/streichen/route.ts` — PATCH-Endpoint
- `app/app/api/einkaufsliste/sync-retry/route.ts` — POST-Endpoint
- `app/__tests__/lib/einkaufsliste-diff.test.ts`
- `app/__tests__/lib/einkaufsliste-berechnen.test.ts`

**Modifizieren:**
- `app/types/index.ts` — `Einkaufsliste`-Interface erweitern, neue Types
- `app/app/api/wochenplan/route.ts` — Genehmigen + Tausch triggern Listen-Logik
- `app/app/api/einkaufsliste/senden/route.ts` — liest aus DB statt on-the-fly
- `app/components/EinkaufslisteSheet.tsx` — komplett neu (liest via API, Streichen, Senden-Button, Status)
- `app/app/wochenplan/page.tsx` — Button vereinfacht, Banner entfernt, Toasts, Sync-Retry

---

## Task 1: Types erweitern

**Files:**
- Modify: `app/types/index.ts`

- [ ] **Schritt 1: Bestehende `Einkaufsliste`-Types ersetzen/erweitern**

Ersetze das bestehende `Einkaufsliste`-Interface (aktuell Zeilen 88–93) und füge neue Types hinzu:

```ts
export interface PicnicListenArtikel {
  picnicProdukt: string
  menge: number
  einheit: string
  artikelId: string
}

export interface EinkaufslisteSnapshot {
  picnic: PicnicListenArtikel[]
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
}

export interface EinkaufslisteSyncFehler {
  sektion: 'picnic' | 'bring1' | 'bring2'
  fehler: string
  timestamp: string
}

export interface Einkaufsliste {
  id: string
  wochenplan_id: string
  picnic: PicnicListenArtikel[]
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
  aus_vorrat: EinkaufsItem[]
  gestrichen: string[]
  gesendet_am: string | null
  gesendet_snapshot: EinkaufslisteSnapshot | null
  sync_fehler: EinkaufslisteSyncFehler | null
  erstellt_am: string
}

export interface EinfrierStatus {
  picnicFrozen: boolean
  bring1Frozen: boolean
  bring2Frozen: boolean
}

export interface SektionDiff {
  hinzu: Array<EinkaufsItem | PicnicListenArtikel>
  weg: Array<EinkaufsItem | PicnicListenArtikel>
}

export interface ListenDiff {
  picnic?: SektionDiff
  bring1?: SektionDiff
  bring2?: SektionDiff
}
```

Das bestehende `EinkaufsArtikel`-Interface (Zeile 81–86) kann bleiben, wird aber nicht mehr genutzt — es zu entfernen würde andere Stellen brechen, also leave-in-place.

- [ ] **Schritt 2: Prüfen dass Types kompilieren**

Run: `cd app && npx tsc --noEmit`
Expected: Keine TypeScript-Fehler bzgl. der neuen Types. Bestehende Fehler in anderen Dateien sind nicht Teil dieses Tasks.

- [ ] **Schritt 3: Commit**

```bash
git add app/types/index.ts
git commit -m "feat(types): Einkaufsliste-Interface um Sektions-Spalten erweitern"
```

---

## Task 2: Supabase-Migration

**Files:**
- Create: `app/supabase/migration_einkaufsliste_v2.sql`

- [ ] **Schritt 1: Migration schreiben**

Erstelle `app/supabase/migration_einkaufsliste_v2.sql`:

```sql
-- Einkaufsliste v2: Sektionen, Snapshot, Gestrichen, Sync-Fehler

alter table einkaufslisten
  add column if not exists picnic jsonb not null default '[]',
  add column if not exists bring1 jsonb not null default '[]',
  add column if not exists bring2 jsonb not null default '[]',
  add column if not exists aus_vorrat jsonb not null default '[]',
  add column if not exists gestrichen jsonb not null default '[]',
  add column if not exists gesendet_am timestamptz,
  add column if not exists gesendet_snapshot jsonb,
  add column if not exists sync_fehler jsonb;

-- Alte artikel-Spalte (ungenutzt) kann bleiben — keine Daten drin
-- Unique-Constraint: pro Wochenplan genau eine Liste
create unique index if not exists einkaufslisten_wochenplan_id_unique
  on einkaufslisten(wochenplan_id);
```

- [ ] **Schritt 2: Migration gegen Supabase-Projekt ausführen**

**Wichtig:** User hat in memory (feedback_supabase_migrations.md) festgelegt, dass Migrationen selbst über CLI/API ausgeführt werden, nicht an den User delegiert.

Ausführung via Supabase MCP-Tool oder CLI. Der Ausführungs-Agent soll:
1. Migration-SQL-Content laden
2. `mcp__claude_ai_Supabase__apply_migration` mit `name: 'einkaufsliste_v2'` und dem SQL-Content aufrufen
3. Auf Erfolgsmeldung prüfen

- [ ] **Schritt 3: Verifizieren**

Via MCP-Tool `mcp__claude_ai_Supabase__list_tables` oder `execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'einkaufslisten'
order by ordinal_position;
```

Expected: Spalten `picnic`, `bring1`, `bring2`, `aus_vorrat`, `gestrichen`, `gesendet_am`, `gesendet_snapshot`, `sync_fehler` existieren.

- [ ] **Schritt 4: Commit**

```bash
git add app/supabase/migration_einkaufsliste_v2.sql
git commit -m "feat(db): Migration einkaufslisten um Sektionen + Snapshot"
```

---

## Task 3: Einfrier-Status-Helper

**Files:**
- Create: `app/lib/einkaufsliste-diff.ts`
- Create: `app/__tests__/lib/einkaufsliste-diff.test.ts`

- [ ] **Schritt 1: Failing Test schreiben**

Erstelle `app/__tests__/lib/einkaufsliste-diff.test.ts`:

```ts
import { bestimmeEinfrierstatus } from '@/lib/einkaufsliste-diff'

describe('bestimmeEinfrierstatus', () => {
  it('Bring-1 ist am Einkaufstag 1 gefroren', () => {
    // Montag = Einkaufstag 1
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, false)
    expect(status.bring1Frozen).toBe(true)
    expect(status.bring2Frozen).toBe(false)
  })

  it('Bring-1 ist vor Einkaufstag 1 offen', () => {
    // Sonntag = Tag 7, vor Einkaufstag 1 = 1 ist nicht sinnvoll,
    // aber Wochentag < einkaufstag_1 = frozen false
    // Besser: Einkaufstag 1 = 5 (Freitag), heute Dienstag = 2
    const dienstag = new Date('2026-04-14T10:00:00Z')
    const status = bestimmeEinfrierstatus(dienstag, 5, 6, false)
    expect(status.bring1Frozen).toBe(false)
    expect(status.bring2Frozen).toBe(false)
  })

  it('Bring-2 ist am Einkaufstag 2 gefroren', () => {
    const donnerstag = new Date('2026-04-16T10:00:00Z')
    const status = bestimmeEinfrierstatus(donnerstag, 1, 4, false)
    expect(status.bring2Frozen).toBe(true)
  })

  it('Picnic ist gefroren wenn bestellung_erkannt = true', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, true)
    expect(status.picnicFrozen).toBe(true)
  })

  it('Picnic ist offen wenn bestellung_erkannt = false', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, false)
    expect(status.picnicFrozen).toBe(false)
  })

  it('Sonntag liefert Wochenindex 7, nicht 0', () => {
    const sonntag = new Date('2026-04-19T10:00:00Z')
    const status = bestimmeEinfrierstatus(sonntag, 1, 4, false)
    expect(status.bring1Frozen).toBe(true)  // 7 >= 1
    expect(status.bring2Frozen).toBe(true)  // 7 >= 4
  })
})
```

- [ ] **Schritt 2: Run test — erwartet FAIL**

Run: `cd app && npx jest einkaufsliste-diff`
Expected: FAIL mit "Cannot find module '@/lib/einkaufsliste-diff'".

- [ ] **Schritt 3: Minimal implementieren**

Erstelle `app/lib/einkaufsliste-diff.ts`:

```ts
import type { EinfrierStatus } from '@/types'

export function bestimmeEinfrierstatus(
  jetzt: Date,
  einkaufstag1: number,
  einkaufstag2: number,
  picnicBestellt: boolean
): EinfrierStatus {
  const tag = jetzt.getDay() === 0 ? 7 : jetzt.getDay()  // So = 7
  return {
    picnicFrozen: picnicBestellt,
    bring1Frozen: tag >= einkaufstag1,
    bring2Frozen: tag >= einkaufstag2,
  }
}
```

- [ ] **Schritt 4: Run test — erwartet PASS**

Run: `cd app && npx jest einkaufsliste-diff`
Expected: PASS alle 6 Tests.

- [ ] **Schritt 5: Commit**

```bash
git add app/lib/einkaufsliste-diff.ts app/__tests__/lib/einkaufsliste-diff.test.ts
git commit -m "feat(einkaufsliste): bestimmeEinfrierstatus Helper"
```

---

## Task 4: Diff-Berechnung

**Files:**
- Modify: `app/lib/einkaufsliste-diff.ts`
- Modify: `app/__tests__/lib/einkaufsliste-diff.test.ts`

- [ ] **Schritt 1: Failing Tests anhängen**

Füge am Ende von `app/__tests__/lib/einkaufsliste-diff.test.ts` hinzu:

```ts
import { berechneBringDiff, berechnePicnicDiff, istGleichBring, istGleichPicnic } from '@/lib/einkaufsliste-diff'
import type { EinkaufsItem, PicnicListenArtikel } from '@/types'

describe('istGleichBring', () => {
  it('true bei identischen Listen', () => {
    const a: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const b: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    expect(istGleichBring(a, b)).toBe(true)
  })

  it('false bei anderer Menge', () => {
    const a: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const b: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 3, einheit: 'Stück' }]
    expect(istGleichBring(a, b)).toBe(false)
  })

  it('true unabhängig von Reihenfolge', () => {
    const a: EinkaufsItem[] = [
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
    ]
    const b: EinkaufsItem[] = [
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
    ]
    expect(istGleichBring(a, b)).toBe(true)
  })
})

describe('berechneBringDiff', () => {
  it('erkennt hinzugefügte Items', () => {
    const alt: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const neu: EinkaufsItem[] = [
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
    ]
    const diff = berechneBringDiff(alt, neu)
    expect(diff.hinzu).toEqual([{ name: 'Paprika', menge: 1, einheit: 'Stück' }])
    expect(diff.weg).toEqual([])
  })

  it('erkennt entfernte Items', () => {
    const alt: EinkaufsItem[] = [
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
    ]
    const neu: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const diff = berechneBringDiff(alt, neu)
    expect(diff.hinzu).toEqual([])
    expect(diff.weg).toEqual([{ name: 'Paprika', menge: 1, einheit: 'Stück' }])
  })

  it('erkennt Mengen-Änderung als weg+hinzu', () => {
    const alt: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const neu: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 3, einheit: 'Stück' }]
    const diff = berechneBringDiff(alt, neu)
    expect(diff.weg).toEqual([{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }])
    expect(diff.hinzu).toEqual([{ name: 'Zwiebeln', menge: 3, einheit: 'Stück' }])
  })
})

describe('istGleichPicnic / berechnePicnicDiff', () => {
  const a: PicnicListenArtikel = { picnicProdukt: 'Bio Zwiebeln 500g', menge: 1, einheit: 'Packung', artikelId: 's1001' }
  const b: PicnicListenArtikel = { picnicProdukt: 'Paprika rot 3er', menge: 1, einheit: 'Packung', artikelId: 's1002' }

  it('istGleichPicnic identisch', () => {
    expect(istGleichPicnic([a], [a])).toBe(true)
  })

  it('istGleichPicnic unterschiedlich', () => {
    expect(istGleichPicnic([a], [b])).toBe(false)
  })

  it('berechnePicnicDiff: +hinzu', () => {
    const diff = berechnePicnicDiff([a], [a, b])
    expect(diff.hinzu).toEqual([b])
    expect(diff.weg).toEqual([])
  })
})
```

- [ ] **Schritt 2: Run tests — erwartet FAIL**

Run: `cd app && npx jest einkaufsliste-diff`
Expected: FAIL mit "berechneBringDiff is not a function" o.ä.

- [ ] **Schritt 3: Implementieren**

Hänge an `app/lib/einkaufsliste-diff.ts` an:

```ts
import type { EinkaufsItem, PicnicListenArtikel, SektionDiff } from '@/types'

function bringKey(item: EinkaufsItem): string {
  return `${item.name.toLowerCase()}|${item.einheit.toLowerCase()}|${item.menge}`
}

function picnicKey(item: PicnicListenArtikel): string {
  return item.artikelId
}

export function istGleichBring(a: EinkaufsItem[], b: EinkaufsItem[]): boolean {
  if (a.length !== b.length) return false
  const keysA = new Set(a.map(bringKey))
  return b.every(item => keysA.has(bringKey(item)))
}

export function istGleichPicnic(a: PicnicListenArtikel[], b: PicnicListenArtikel[]): boolean {
  if (a.length !== b.length) return false
  const keysA = new Set(a.map(picnicKey))
  return b.every(item => keysA.has(picnicKey(item)))
}

export function berechneBringDiff(alt: EinkaufsItem[], neu: EinkaufsItem[]): SektionDiff {
  const altKeys = new Map(alt.map(item => [bringKey(item), item]))
  const neuKeys = new Map(neu.map(item => [bringKey(item), item]))

  const hinzu: EinkaufsItem[] = []
  const weg: EinkaufsItem[] = []

  for (const [key, item] of neuKeys) {
    if (!altKeys.has(key)) hinzu.push(item)
  }
  for (const [key, item] of altKeys) {
    if (!neuKeys.has(key)) weg.push(item)
  }

  return { hinzu, weg }
}

export function berechnePicnicDiff(
  alt: PicnicListenArtikel[],
  neu: PicnicListenArtikel[]
): SektionDiff {
  const altIds = new Set(alt.map(p => p.artikelId))
  const neuIds = new Set(neu.map(p => p.artikelId))

  const hinzu = neu.filter(p => !altIds.has(p.artikelId))
  const weg = alt.filter(p => !neuIds.has(p.artikelId))

  return { hinzu, weg }
}
```

- [ ] **Schritt 4: Run tests — erwartet PASS**

Run: `cd app && npx jest einkaufsliste-diff`
Expected: PASS alle Tests (6 + 9 = 15).

- [ ] **Schritt 5: Commit**

```bash
git add app/lib/einkaufsliste-diff.ts app/__tests__/lib/einkaufsliste-diff.test.ts
git commit -m "feat(einkaufsliste): Diff-Berechnung und Gleichheit pro Sektion"
```

---

## Task 5: Listen-Berechnungs-Wrapper

**Files:**
- Create: `app/lib/einkaufsliste-berechnen.ts`
- Create: `app/__tests__/lib/einkaufsliste-berechnen.test.ts`

Dies wrappt `generiereEinkaufslisten` + `splitNachRouting` + `verarbeitePicnicListe` + wendet den `gestrichen`-Filter an. Die Picnic-Suche nutzt die echte Picnic-API, die Tests mocken diese.

- [ ] **Schritt 1: Failing Test schreiben**

Erstelle `app/__tests__/lib/einkaufsliste-berechnen.test.ts`:

```ts
import { wendeGestrichenAn, zaehleItems } from '@/lib/einkaufsliste-berechnen'
import type { EinkaufsItem, PicnicListenArtikel } from '@/types'

describe('wendeGestrichenAn', () => {
  const items: EinkaufsItem[] = [
    { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
    { name: 'Paprika', menge: 1, einheit: 'Stück' },
    { name: 'Zucchini', menge: 1, einheit: 'Stück' },
  ]

  it('entfernt gestrichene Items case-insensitive', () => {
    const result = wendeGestrichenAn(items, ['paprika'])
    expect(result).toEqual([
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Zucchini', menge: 1, einheit: 'Stück' },
    ])
  })

  it('leere gestrichen-Liste lässt alles drin', () => {
    expect(wendeGestrichenAn(items, [])).toEqual(items)
  })

  it('unbekannte Namen in gestrichen beeinflussen nichts', () => {
    expect(wendeGestrichenAn(items, ['Quatsch'])).toEqual(items)
  })
})

describe('zaehleItems', () => {
  it('zählt picnic + bring1 + bring2, nicht ausVorrat', () => {
    const picnic: PicnicListenArtikel[] = [
      { picnicProdukt: 'A', menge: 1, einheit: 'Packung', artikelId: '1' },
    ]
    const bring1: EinkaufsItem[] = [{ name: 'X', menge: 1, einheit: 'g' }]
    const bring2: EinkaufsItem[] = [
      { name: 'Y', menge: 1, einheit: 'g' },
      { name: 'Z', menge: 1, einheit: 'g' },
    ]
    expect(zaehleItems({ picnic, bring1, bring2, aus_vorrat: [] } as never)).toBe(4)
  })
})
```

- [ ] **Schritt 2: Run test — erwartet FAIL**

Run: `cd app && npx jest einkaufsliste-berechnen`
Expected: FAIL (Modul nicht gefunden).

- [ ] **Schritt 3: Implementieren**

Erstelle `app/lib/einkaufsliste-berechnen.ts`:

```ts
import type {
  EinkaufsItem,
  PicnicListenArtikel,
  Einkaufsliste,
  WochenplanEintrag,
  Gericht,
  VorratEintrag,
  Regelbedarf,
} from '@/types'
import { generiereEinkaufslisten, splitNachRouting, aggregiere } from '@/lib/einkaufsliste'
import { sucheArtikel } from '@/lib/picnic'

export function wendeGestrichenAn(items: EinkaufsItem[], gestrichen: string[]): EinkaufsItem[] {
  if (gestrichen.length === 0) return items
  const set = new Set(gestrichen.map(s => s.toLowerCase()))
  return items.filter(i => !set.has(i.name.toLowerCase()))
}

export function wendeGestrichenAnPicnic(
  items: PicnicListenArtikel[],
  gestrichen: string[]
): PicnicListenArtikel[] {
  if (gestrichen.length === 0) return items
  const set = new Set(gestrichen.map(s => s.toLowerCase()))
  return items.filter(i => !set.has(i.picnicProdukt.toLowerCase()))
}

export function zaehleItems(
  liste: Pick<Einkaufsliste, 'picnic' | 'bring1' | 'bring2'>
): number {
  return liste.picnic.length + liste.bring1.length + liste.bring2.length
}

export interface ListenEingabe {
  eintraege: WochenplanEintrag[]
  gerichte: Gericht[]
  einkaufstag2: number
  regelbedarf: Regelbedarf[]
  vorrat: VorratEintrag[]
  bringKeywords: string[]
  mindestbestellwert: number
  extrasZutaten: EinkaufsItem[]
  gestrichen: string[]
}

export interface BerechneteListen {
  picnic: PicnicListenArtikel[]
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
  ausVorrat: EinkaufsItem[]
}

export async function berechneListeFuerPlan(eingabe: ListenEingabe): Promise<BerechneteListen> {
  const regelbedarfNamen = eingabe.regelbedarf.map(r => r.name)
  const { einkauf1, einkauf2, ausVorrat } = generiereEinkaufslisten(
    eingabe.eintraege,
    eingabe.gerichte,
    eingabe.einkaufstag2,
    regelbedarfNamen,
    eingabe.vorrat
  )

  const einkauf1MitExtras = aggregiere([...einkauf1, ...eingabe.extrasZutaten])
  const routing1 = splitNachRouting(einkauf1MitExtras, eingabe.bringKeywords)

  // Picnic-Suche für Bring-1-Kandidaten + Regelbedarf
  const picnicKandidaten = [...routing1.picnic]
  const picnicArtikel: PicnicListenArtikel[] = []
  const nichtGefunden: EinkaufsItem[] = []
  let gesamtpreis = 0

  for (const item of picnicKandidaten) {
    const artikel = await sucheArtikel(item.name)
    if (artikel) {
      picnicArtikel.push({
        picnicProdukt: artikel.name,
        menge: item.menge,
        einheit: item.einheit,
        artikelId: artikel.artikelId,
      })
      gesamtpreis += artikel.preis / 100
    } else {
      nichtGefunden.push(item)
    }
  }

  // Regelbedarf-Artikel zusätzlich in Picnic suchen
  for (const r of eingabe.regelbedarf) {
    const artikel = await sucheArtikel(r.name)
    if (artikel) {
      picnicArtikel.push({
        picnicProdukt: artikel.name,
        menge: r.menge,
        einheit: r.einheit,
        artikelId: artikel.artikelId,
      })
    }
  }

  // Mindestbestellwert-Fallback: wenn unter Mindest → alles nach Bring
  const unterMindestwert = gesamtpreis < eingabe.mindestbestellwert
  const bring1Final = unterMindestwert
    ? [...routing1.bring, ...picnicKandidaten]
    : [...routing1.bring, ...nichtGefunden]

  const picnicFinal = unterMindestwert ? [] : picnicArtikel

  return {
    picnic: wendeGestrichenAnPicnic(picnicFinal, eingabe.gestrichen),
    bring1: wendeGestrichenAn(bring1Final, eingabe.gestrichen),
    bring2: wendeGestrichenAn(aggregiere(einkauf2), eingabe.gestrichen),
    ausVorrat,
  }
}
```

- [ ] **Schritt 4: Run test — erwartet PASS**

Run: `cd app && npx jest einkaufsliste-berechnen`
Expected: PASS für `wendeGestrichenAn`- und `zaehleItems`-Tests.

- [ ] **Schritt 5: Commit**

```bash
git add app/lib/einkaufsliste-berechnen.ts app/__tests__/lib/einkaufsliste-berechnen.test.ts
git commit -m "feat(einkaufsliste): Wrapper berechneListeFuerPlan + Gestrichen-Filter"
```

---

## Task 6: Persistenz-Layer

**Files:**
- Create: `app/lib/einkaufsliste-persistence.ts`

Keine dedizierten Unit-Tests — die Funktionen sind Thin Wrappers um Supabase-Aufrufe, die Fehlerpfade werden in Integration-Tests (Task 14) abgedeckt.

- [ ] **Schritt 1: Implementieren**

Erstelle `app/lib/einkaufsliste-persistence.ts`:

```ts
import { supabase } from '@/lib/supabase-server'
import type {
  Einkaufsliste,
  EinkaufslisteSyncFehler,
  EinkaufslisteSnapshot,
  EinkaufsItem,
  PicnicListenArtikel,
} from '@/types'

export async function ladeListe(wochenplanId: string): Promise<Einkaufsliste | null> {
  const { data, error } = await supabase
    .from('einkaufslisten')
    .select('*')
    .eq('wochenplan_id', wochenplanId)
    .maybeSingle()
  if (error) throw error
  return (data as Einkaufsliste) ?? null
}

export interface UpsertListeInput {
  wochenplan_id: string
  picnic: PicnicListenArtikel[]
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
  aus_vorrat: EinkaufsItem[]
  gestrichen?: string[]
}

export async function upsertListe(input: UpsertListeInput): Promise<Einkaufsliste> {
  const { data, error } = await supabase
    .from('einkaufslisten')
    .upsert(
      {
        wochenplan_id: input.wochenplan_id,
        picnic: input.picnic,
        bring1: input.bring1,
        bring2: input.bring2,
        aus_vorrat: input.aus_vorrat,
        gestrichen: input.gestrichen ?? [],
      },
      { onConflict: 'wochenplan_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data as Einkaufsliste
}

export async function aktualisiereSektionen(
  wochenplanId: string,
  patch: Partial<Pick<Einkaufsliste, 'picnic' | 'bring1' | 'bring2' | 'aus_vorrat'>>
): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update(patch)
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function setzeGestrichen(wochenplanId: string, gestrichen: string[]): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update({ gestrichen })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function markiereAlsGesendet(
  wochenplanId: string,
  snapshot: EinkaufslisteSnapshot
): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update({
      gesendet_am: new Date().toISOString(),
      gesendet_snapshot: snapshot,
      sync_fehler: null,
    })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function setzeSyncFehler(
  wochenplanId: string,
  fehler: EinkaufslisteSyncFehler | null
): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update({ sync_fehler: fehler })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function aktualisiereSnapshotTeilweise(
  wochenplanId: string,
  current: EinkaufslisteSnapshot,
  patch: Partial<EinkaufslisteSnapshot>
): Promise<void> {
  const snapshot = { ...current, ...patch }
  const { error } = await supabase
    .from('einkaufslisten')
    .update({ gesendet_snapshot: snapshot })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}
```

- [ ] **Schritt 2: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine neuen TypeScript-Fehler in `einkaufsliste-persistence.ts`.

- [ ] **Schritt 3: Commit**

```bash
git add app/lib/einkaufsliste-persistence.ts
git commit -m "feat(einkaufsliste): Persistenz-Layer fuer DB-Operationen"
```

---

## Task 7: GET /api/einkaufsliste

**Files:**
- Create: `app/app/api/einkaufsliste/route.ts`

- [ ] **Schritt 1: Implementieren**

Erstelle `app/app/api/einkaufsliste/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { ladeListe } from '@/lib/einkaufsliste-persistence'

export async function GET(req: NextRequest) {
  const wochenplanId = req.nextUrl.searchParams.get('wochenplan_id')
  if (!wochenplanId) {
    return NextResponse.json({ error: 'wochenplan_id fehlt' }, { status: 400 })
  }

  try {
    const liste = await ladeListe(wochenplanId)
    return NextResponse.json(liste)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Schritt 2: Smoketest**

Run: `cd app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/einkaufsliste/route.ts
git commit -m "feat(api): GET /api/einkaufsliste liefert Liste per Wochenplan-ID"
```

---

## Task 8: PATCH /api/einkaufsliste/streichen

**Files:**
- Create: `app/app/api/einkaufsliste/streichen/route.ts`

- [ ] **Schritt 1: Implementieren**

Erstelle `app/app/api/einkaufsliste/streichen/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { ladeListe, setzeGestrichen } from '@/lib/einkaufsliste-persistence'

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.wochenplan_id !== 'string' || typeof body.zutatName !== 'string' || typeof body.streichen !== 'boolean') {
    return NextResponse.json(
      { error: 'Request braucht wochenplan_id (string), zutatName (string) und streichen (boolean)' },
      { status: 400 }
    )
  }

  try {
    const liste = await ladeListe(body.wochenplan_id)
    if (!liste) {
      return NextResponse.json({ error: 'Liste nicht gefunden' }, { status: 404 })
    }
    if (liste.gesendet_am !== null) {
      return NextResponse.json(
        { error: 'Liste wurde bereits gesendet — Streichen nicht mehr möglich' },
        { status: 409 }
      )
    }

    const aktuell = new Set(liste.gestrichen)
    const name = body.zutatName
    if (body.streichen) aktuell.add(name)
    else aktuell.delete(name)

    await setzeGestrichen(body.wochenplan_id, [...aktuell])
    return NextResponse.json({ gestrichen: [...aktuell] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Schritt 2: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/einkaufsliste/streichen/route.ts
git commit -m "feat(api): PATCH /api/einkaufsliste/streichen fuer Vor-Senden-Filter"
```

---

## Task 9: Wochenplan-PUT — Bei Genehmigen Liste berechnen

**Files:**
- Modify: `app/app/api/wochenplan/route.ts`

Der Wochenplan-Handler bekommt zwei neue Verantwortlichkeiten. Dieser Task ist Teil 1: Bei Übergang `entwurf → genehmigt` wird die Einkaufsliste automatisch berechnet.

- [ ] **Schritt 1: Handler erweitern**

Ersetze den kompletten Inhalt von `app/app/api/wochenplan/route.ts` mit:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { ladeWochenAnsicht, speichereWochenplan } from '@/lib/wochenplan'
import { supabase } from '@/lib/supabase-server'
import { berechneListeFuerPlan } from '@/lib/einkaufsliste-berechnen'
import { upsertListe } from '@/lib/einkaufsliste-persistence'
import { ladeVorrat } from '@/lib/vorrat'
import { ladeExtrasForPlan } from '@/lib/extras'
import type { WochenplanEintrag, Gericht, Regelbedarf, EinkaufsItem, Wochenplan } from '@/types'

export async function GET() {
  const ansicht = await ladeWochenAnsicht()
  return NextResponse.json(ansicht)
}

async function ladePicnicEinstellungen() {
  const { data } = await supabase
    .from('einstellungen')
    .select('key, value')
    .in('key', ['picnic_mindestbestellwert', 'picnic_bring_keywords'])
  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return {
    mindestbestellwert: parseInt(map['picnic_mindestbestellwert'] ?? '35', 10),
    bringKeywords: (() => { try { return JSON.parse(map['picnic_bring_keywords'] ?? '[]') as string[] } catch { return [] } })(),
  }
}

async function ladeRegelbedarf(): Promise<Regelbedarf[]> {
  const { data } = await supabase.from('regelbedarf').select('*')
  return (data ?? []) as Regelbedarf[]
}

async function ladeExtrasZutatenFuerPlan(wochenplanId: string): Promise<EinkaufsItem[]> {
  const extras = await ladeExtrasForPlan(wochenplanId)
  const ids = extras.map(e => e.katalog_id).filter((i): i is string => i !== null)
  if (ids.length === 0) return []
  const { data } = await supabase.from('extras_katalog').select('zutaten').in('id', ids)
  const items: EinkaufsItem[] = []
  for (const row of data ?? []) {
    const zutaten = (row.zutaten ?? []) as Array<{ name: string; menge: number; einheit: string }>
    for (const z of zutaten) items.push({ name: z.name, menge: z.menge, einheit: z.einheit })
  }
  return items
}

async function berechneUndPersistiere(plan: Wochenplan, gestrichen: string[] = []) {
  const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
  const [{ data: gerichte }, einstellungen, regelbedarf, vorrat, extrasZutaten] = await Promise.all([
    supabase.from('gerichte').select('*'),
    ladePicnicEinstellungen(),
    ladeRegelbedarf(),
    ladeVorrat(),
    ladeExtrasZutatenFuerPlan(plan.id),
  ])

  const listen = await berechneListeFuerPlan({
    eintraege: plan.eintraege,
    gerichte: (gerichte ?? []) as Gericht[],
    einkaufstag2,
    regelbedarf,
    vorrat,
    bringKeywords: einstellungen.bringKeywords,
    mindestbestellwert: einstellungen.mindestbestellwert,
    extrasZutaten,
    gestrichen,
  })

  await upsertListe({
    wochenplan_id: plan.id,
    picnic: listen.picnic,
    bring1: listen.bring1,
    bring2: listen.bring2,
    aus_vorrat: listen.ausVorrat,
    gestrichen,
  })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })

  const { eintraege, status }: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' } = body
  if (!Array.isArray(eintraege)) {
    return NextResponse.json({ error: 'eintraege muss ein Array sein' }, { status: 400 })
  }
  if (status !== 'entwurf' && status !== 'genehmigt') {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  try {
    const { aktiverPlan: vorher } = await ladeWochenAnsicht()
    const plan = await speichereWochenplan(eintraege, status)

    const wechseltZuGenehmigt = status === 'genehmigt' && (!vorher || vorher.status !== 'genehmigt')
    if (wechseltZuGenehmigt) {
      await berechneUndPersistiere(plan, [])
    }

    return NextResponse.json(plan)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Schritt 2: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine neuen Fehler (bestehende Fehler in anderen Dateien sind nicht Teil dieses Tasks).

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/wochenplan/route.ts
git commit -m "feat(wochenplan): Auto-Listen-Berechnung bei Genehmigen"
```

---

## Task 10: Wochenplan-PUT — Tausch vor Senden

**Files:**
- Modify: `app/app/api/wochenplan/route.ts`

Zweite Erweiterung: Wenn eine Liste existiert und `gesendet_am IS NULL` (Zustand 1 Berechnet), wird sie beim Plan-Update komplett neu berechnet.

- [ ] **Schritt 1: `ladeListe` in Imports ergänzen**

Ändere die Import-Zeile für `einkaufsliste-persistence` in `app/app/api/wochenplan/route.ts`:

```ts
import { ladeListe, upsertListe } from '@/lib/einkaufsliste-persistence'
```

- [ ] **Schritt 2: Handler erweitern**

Füge in `app/app/api/wochenplan/route.ts` im `PUT`-Handler direkt nach dem `berechneUndPersistiere(plan, [])`-Block (für Genehmigen) dieses Snippet ein — vor dem `return`:

```ts
    // Tausch (Plan bereits genehmigt): Liste ggf. neu berechnen oder diffen
    if (!wechseltZuGenehmigt && status === 'genehmigt') {
      const liste = await ladeListe(plan.id)
      if (liste && liste.gesendet_am === null) {
        // Zustand (1): einfach überschreiben, Gestrichen-Filter wieder anwenden
        await berechneUndPersistiere(plan, liste.gestrichen)
      }
      // Zustand (2)+: Diff — kommt in Task 11
    }
```

Der gesamte PUT-Handler sieht danach so aus:

```ts
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })

  const { eintraege, status }: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' } = body
  if (!Array.isArray(eintraege)) {
    return NextResponse.json({ error: 'eintraege muss ein Array sein' }, { status: 400 })
  }
  if (status !== 'entwurf' && status !== 'genehmigt') {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 })
  }

  try {
    const { aktiverPlan: vorher } = await ladeWochenAnsicht()
    const plan = await speichereWochenplan(eintraege, status)

    const wechseltZuGenehmigt = status === 'genehmigt' && (!vorher || vorher.status !== 'genehmigt')
    if (wechseltZuGenehmigt) {
      await berechneUndPersistiere(plan, [])
    }

    if (!wechseltZuGenehmigt && status === 'genehmigt') {
      const liste = await ladeListe(plan.id)
      if (liste && liste.gesendet_am === null) {
        await berechneUndPersistiere(plan, liste.gestrichen)
      }
      // Zustand (2)+ Diff folgt in Task 11
    }

    return NextResponse.json(plan)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Schritt 3: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine neuen Fehler.

- [ ] **Schritt 4: Commit**

```bash
git add app/app/api/wochenplan/route.ts
git commit -m "feat(wochenplan): Liste bei Tausch vor Senden neu berechnen"
```

---

## Task 11: Wochenplan-PUT — Diff-Update nach Senden

**Files:**
- Modify: `app/app/api/wochenplan/route.ts`

Dritter Teil: Wenn `gesendet_am NOT NULL`, Diff gegen Snapshot, nur offene Sektionen an Bring/Picnic syncen.

- [ ] **Schritt 1: Diff-Update-Helper anhängen**

Füge in `app/app/api/wochenplan/route.ts` oberhalb des `PUT`-Handlers hinzu:

```ts
import { bestimmeEinfrierstatus, istGleichBring, istGleichPicnic, berechneBringDiff, berechnePicnicDiff } from '@/lib/einkaufsliste-diff'
import { aktualisiereSektionen, aktualisiereSnapshotTeilweise, setzeSyncFehler } from '@/lib/einkaufsliste-persistence'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { zumWarenkorb, warenkorbLeeren } from '@/lib/picnic'
import type { Einkaufsliste, EinkaufslisteSnapshot, ListenDiff } from '@/types'

async function ladeBestellStatus(wochenplanId: string): Promise<boolean> {
  const { data } = await supabase
    .from('picnic_bestellung_status')
    .select('bestellung_erkannt')
    .eq('wochenplan_id', wochenplanId)
    .maybeSingle()
  return Boolean(data?.bestellung_erkannt)
}

async function fuehreDiffUpdateDurch(
  liste: Einkaufsliste,
  neu: { picnic: Einkaufsliste['picnic']; bring1: Einkaufsliste['bring1']; bring2: Einkaufsliste['bring2']; aus_vorrat: Einkaufsliste['aus_vorrat'] }
): Promise<ListenDiff> {
  const einkaufstag1 = parseInt(process.env.EINKAUFSTAG_1 ?? '1', 10)
  const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
  const picnicBestellt = await ladeBestellStatus(liste.wochenplan_id)
  const frozen = bestimmeEinfrierstatus(new Date(), einkaufstag1, einkaufstag2, picnicBestellt)

  const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
  const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'
  const snapshot = liste.gesendet_snapshot as EinkaufslisteSnapshot

  const diffs: ListenDiff = {}
  const neuerSnapshot: Partial<EinkaufslisteSnapshot> = {}

  // Bring-1
  if (!frozen.bring1Frozen && !istGleichBring(snapshot.bring1, neu.bring1)) {
    try {
      await aktualisiereEinkaufsliste(listName1, neu.bring1)
      diffs.bring1 = berechneBringDiff(snapshot.bring1, neu.bring1)
      neuerSnapshot.bring1 = neu.bring1
    } catch (e) {
      await setzeSyncFehler(liste.wochenplan_id, {
        sektion: 'bring1',
        fehler: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Bring-2
  if (!frozen.bring2Frozen && !istGleichBring(snapshot.bring2, neu.bring2)) {
    try {
      await aktualisiereEinkaufsliste(listName2, neu.bring2)
      diffs.bring2 = berechneBringDiff(snapshot.bring2, neu.bring2)
      neuerSnapshot.bring2 = neu.bring2
    } catch (e) {
      await setzeSyncFehler(liste.wochenplan_id, {
        sektion: 'bring2',
        fehler: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Picnic (Full-Replace, weil Picnic-API kein einzelnes Remove kennt)
  if (!frozen.picnicFrozen && !istGleichPicnic(snapshot.picnic, neu.picnic)) {
    try {
      await warenkorbLeeren()
      for (const p of neu.picnic) {
        await zumWarenkorb(p.artikelId, 1)
      }
      diffs.picnic = berechnePicnicDiff(snapshot.picnic, neu.picnic)
      neuerSnapshot.picnic = neu.picnic
    } catch (e) {
      await setzeSyncFehler(liste.wochenplan_id, {
        sektion: 'picnic',
        fehler: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Liste aktualisieren (immer, auch bei Sync-Fehlern — DB hält neuesten berechneten Stand)
  await aktualisiereSektionen(liste.wochenplan_id, {
    picnic: neu.picnic,
    bring1: neu.bring1,
    bring2: neu.bring2,
    aus_vorrat: neu.aus_vorrat,
  })

  if (Object.keys(neuerSnapshot).length > 0) {
    await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, neuerSnapshot)
  }

  return diffs
}
```

- [ ] **Schritt 2: PUT-Handler erweitern**

Ersetze im `PUT`-Handler den Kommentar `// Zustand (2)+ Diff folgt in Task 11` durch die Implementation. Der relevante Block wird zu:

```ts
    if (!wechseltZuGenehmigt && status === 'genehmigt') {
      const liste = await ladeListe(plan.id)
      if (liste && liste.gesendet_am === null) {
        await berechneUndPersistiere(plan, liste.gestrichen)
      } else if (liste && liste.gesendet_am !== null && liste.gesendet_snapshot) {
        // Zustand (2)+: berechne neue Liste, diffe gegen Snapshot
        const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
        const [{ data: gerichte }, einstellungen, regelbedarf, vorrat, extrasZutaten] = await Promise.all([
          supabase.from('gerichte').select('*'),
          ladePicnicEinstellungen(),
          ladeRegelbedarf(),
          ladeVorrat(),
          ladeExtrasZutatenFuerPlan(plan.id),
        ])
        const neueListen = await berechneListeFuerPlan({
          eintraege: plan.eintraege,
          gerichte: (gerichte ?? []) as Gericht[],
          einkaufstag2,
          regelbedarf,
          vorrat,
          bringKeywords: einstellungen.bringKeywords,
          mindestbestellwert: einstellungen.mindestbestellwert,
          extrasZutaten,
          gestrichen: liste.gestrichen,
        })
        const diffs = await fuehreDiffUpdateDurch(liste, {
          picnic: neueListen.picnic,
          bring1: neueListen.bring1,
          bring2: neueListen.bring2,
          aus_vorrat: neueListen.ausVorrat,
        })
        return NextResponse.json({ ...plan, einkaufslisten_diff: diffs })
      }
    }
```

Wichtig: Wir hängen das `einkaufslisten_diff`-Property nur im Diff-Fall an die Response — das Frontend nutzt es, um den Toast zu bauen.

- [ ] **Schritt 3: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine neuen Fehler.

- [ ] **Schritt 4: Commit**

```bash
git add app/app/api/wochenplan/route.ts
git commit -m "feat(wochenplan): Diff-Update nach Gericht-Tausch bei gesendeter Liste"
```

---

## Task 12: /api/einkaufsliste/senden umbauen

**Files:**
- Modify: `app/app/api/einkaufsliste/senden/route.ts`

Der Handler liest jetzt aus der DB statt on-the-fly zu berechnen und setzt nach Erfolg den Send-Snapshot.

- [ ] **Schritt 1: Handler neu schreiben**

Ersetze den kompletten Inhalt von `app/app/api/einkaufsliste/senden/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import { ladeWochenAnsicht } from '@/lib/wochenplan'
import { ladeListe, markiereAlsGesendet } from '@/lib/einkaufsliste-persistence'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { zumWarenkorb, warenkorbLeeren } from '@/lib/picnic'
import { ladeVorrat, aktualisiereVorrat, parsePaketgroesse, normalisiereEinheit, istTracked } from '@/lib/vorrat'
import type { Gericht } from '@/types'

async function mitRetry<T>(fn: () => Promise<T>, versuche = 3): Promise<T> {
  for (let i = 0; i < versuche; i++) {
    try { return await fn() } catch (e) {
      if (i === versuche - 1) throw e
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw new Error('Unreachable')
}

export async function POST() {
  try {
    const { aktiverPlan: plan } = await ladeWochenAnsicht()
    if (!plan) return NextResponse.json({ error: 'Kein Wochenplan für diese Woche gefunden' }, { status: 404 })

    const liste = await ladeListe(plan.id)
    if (!liste) return NextResponse.json({ error: 'Einkaufsliste wurde noch nicht berechnet' }, { status: 404 })
    if (liste.gesendet_am !== null) {
      return NextResponse.json({ error: 'Einkaufsliste wurde bereits gesendet' }, { status: 409 })
    }

    const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
    const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'

    // Picnic-Warenkorb füllen (sequenziell — Race-Safety)
    await warenkorbLeeren()
    for (const p of liste.picnic) {
      await zumWarenkorb(p.artikelId, 1)
    }

    await Promise.all([
      mitRetry(() => aktualisiereEinkaufsliste(listName1, liste.bring1)),
      mitRetry(() => aktualisiereEinkaufsliste(listName2, liste.bring2)),
    ])

    // Vorrat aktualisieren (tracked Picnic-Artikel)
    const { data: gerichte } = await supabase.from('gerichte').select('*')
    const vorrat = await ladeVorrat()
    const haltbarkeitMap = new Map<string, number>()
    for (const g of (gerichte ?? []) as Gericht[]) {
      for (const z of g.zutaten) haltbarkeitMap.set(z.name.toLowerCase(), z.haltbarkeit_tage)
    }
    const kaufeFuerVorrat = liste.picnic
      .filter(p => istTracked(haltbarkeitMap.get(p.picnicProdukt.toLowerCase()) ?? 0))
      .map(p => ({
        zutat_name: p.picnicProdukt.toLowerCase(),
        paket: parsePaketgroesse(p.picnicProdukt),
        verbrauch: normalisiereEinheit(p.menge, p.einheit),
      }))
    const ausVorratFuerUpdate = liste.aus_vorrat.map(item => ({
      zutat_name: item.name.toLowerCase(),
      verbrauch: normalisiereEinheit(item.menge, item.einheit),
    }))
    await aktualisiereVorrat(vorrat, kaufeFuerVorrat, ausVorratFuerUpdate)

    // Snapshot + gesendet_am setzen
    await markiereAlsGesendet(plan.id, {
      picnic: liste.picnic,
      bring1: liste.bring1,
      bring2: liste.bring2,
    })

    // Bestellstatus-Snapshot fuer Picnic-Check
    await supabase.from('picnic_bestellung_status').upsert(
      {
        wochenplan_id: plan.id,
        gesendete_produkte: liste.picnic.map(p => p.picnicProdukt),
        bestellung_erkannt: false,
        bestellung_id: null,
        fehlende_produkte: [],
        geprueft_am: null,
      },
      { onConflict: 'wochenplan_id' }
    )

    return NextResponse.json({
      einkauf1Count: liste.bring1.length,
      einkauf2Count: liste.bring2.length,
      picnic1Count: liste.picnic.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    const istTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('blocking read')
    return NextResponse.json(
      { error: istTimeout ? 'Verbindung fehlgeschlagen — bitte erneut versuchen' : (msg || 'Unbekannter Fehler') },
      { status: 500 }
    )
  }
}
```

- [ ] **Schritt 2: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine neuen Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/einkaufsliste/senden/route.ts
git commit -m "refactor(senden): liest Liste aus DB statt on-the-fly, setzt Snapshot"
```

---

## Task 13: POST /api/einkaufsliste/sync-retry

**Files:**
- Create: `app/app/api/einkaufsliste/sync-retry/route.ts`

- [ ] **Schritt 1: Implementieren**

Erstelle `app/app/api/einkaufsliste/sync-retry/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { ladeListe, setzeSyncFehler, aktualisiereSnapshotTeilweise } from '@/lib/einkaufsliste-persistence'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { warenkorbLeeren, zumWarenkorb } from '@/lib/picnic'
import type { EinkaufslisteSnapshot } from '@/types'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body.wochenplan_id !== 'string') {
    return NextResponse.json({ error: 'wochenplan_id fehlt' }, { status: 400 })
  }

  try {
    const liste = await ladeListe(body.wochenplan_id)
    if (!liste || !liste.sync_fehler) {
      return NextResponse.json({ retried: false })
    }

    const sektion = liste.sync_fehler.sektion
    const snapshot = liste.gesendet_snapshot as EinkaufslisteSnapshot | null
    if (!snapshot) {
      // Nichts zum Retry — zurücksetzen
      await setzeSyncFehler(liste.wochenplan_id, null)
      return NextResponse.json({ retried: false })
    }

    if (sektion === 'bring1') {
      const name = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
      await aktualisiereEinkaufsliste(name, liste.bring1)
      await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, { bring1: liste.bring1 })
    } else if (sektion === 'bring2') {
      const name = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'
      await aktualisiereEinkaufsliste(name, liste.bring2)
      await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, { bring2: liste.bring2 })
    } else if (sektion === 'picnic') {
      await warenkorbLeeren()
      for (const p of liste.picnic) {
        await zumWarenkorb(p.artikelId, 1)
      }
      await aktualisiereSnapshotTeilweise(liste.wochenplan_id, snapshot, { picnic: liste.picnic })
    }

    await setzeSyncFehler(liste.wochenplan_id, null)
    return NextResponse.json({ retried: true, sektion })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Schritt 2: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine neuen Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add app/app/api/einkaufsliste/sync-retry/route.ts
git commit -m "feat(api): POST /api/einkaufsliste/sync-retry fuer auto-Recovery"
```

---

## Task 14: EinkaufslisteSheet umbauen

**Files:**
- Modify: `app/components/EinkaufslisteSheet.tsx`

Neu: Sheet liest die Liste via API (Prop `wochenplanId`), stellt kontextsensitiv dar, bietet Streichen/Senden/Status-Darstellung.

- [ ] **Schritt 1: Sheet komplett neu schreiben**

Ersetze den kompletten Inhalt von `app/components/EinkaufslisteSheet.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { Einkaufsliste, EinkaufsItem, PicnicListenArtikel } from '@/types'

interface EinkaufslisteSheetProps {
  wochenplanId: string
  bestellStatus: {
    status: 'offen' | 'bestellt' | 'keine_liste' | 'kein_plan'
    fehlende_produkte?: string[]
    gesendete_anzahl?: number
  } | null
  onClose: () => void
  onSent: () => void
}

function statusText(liste: Einkaufsliste | null, bestellt: boolean): string {
  if (!liste) return 'Lädt …'
  if (liste.gesendet_am === null) return 'Entwurf — noch nicht gesendet'
  if (bestellt) return `✓ Bestellt`
  return `Gesendet am ${new Date(liste.gesendet_am).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
}

function ZeileBring({ item, gestrichen, onToggle, editable }: {
  item: EinkaufsItem
  gestrichen: boolean
  onToggle: () => void
  editable: boolean
}) {
  return (
    <li className="text-sm flex items-baseline gap-2 py-1" style={{ color: gestrichen ? 'var(--gray-secondary)' : 'var(--near-black)' }}>
      <span style={{ color: 'var(--rausch)', flexShrink: 0 }}>·</span>
      <span className={`flex-1 ${gestrichen ? 'line-through' : ''}`}>{item.name}</span>
      {item.menge > 0 && (
        <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>
          {item.menge} {item.einheit}
        </span>
      )}
      {editable && (
        <button
          onClick={onToggle}
          aria-label={gestrichen ? 'Wiederherstellen' : 'Streichen'}
          className="w-6 h-6 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: gestrichen ? 'var(--surface)' : 'transparent', color: 'var(--gray-secondary)' }}
        >
          {gestrichen ? '↶' : '×'}
        </button>
      )}
    </li>
  )
}

function ZeilePicnic({ item, gestrichen, bestellt, fehlt, onToggle, editable }: {
  item: PicnicListenArtikel
  gestrichen: boolean
  bestellt: boolean
  fehlt: boolean
  onToggle: () => void
  editable: boolean
}) {
  return (
    <li className="text-sm flex items-baseline gap-2 py-1" style={{ color: gestrichen ? 'var(--gray-secondary)' : 'var(--near-black)' }}>
      <span style={{ color: bestellt ? '#166534' : fehlt ? '#92400e' : '#5ba832', flexShrink: 0 }}>
        {bestellt ? '✓' : fehlt ? '⚠' : '·'}
      </span>
      <span className={`flex-1 ${gestrichen ? 'line-through' : ''}`}>{item.picnicProdukt}</span>
      {item.menge > 0 && (
        <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>
          {item.menge} {item.einheit}
        </span>
      )}
      {editable && (
        <button
          onClick={onToggle}
          aria-label={gestrichen ? 'Wiederherstellen' : 'Streichen'}
          className="w-6 h-6 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: gestrichen ? 'var(--surface)' : 'transparent', color: 'var(--gray-secondary)' }}
        >
          {gestrichen ? '↶' : '×'}
        </button>
      )}
    </li>
  )
}

export function EinkaufslisteSheet({ wochenplanId, bestellStatus, onClose, onSent }: EinkaufslisteSheetProps) {
  const [liste, setListe] = useState<Einkaufsliste | null>(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const touchStartY = useRef<number | null>(null)

  const laden = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/einkaufsliste?wochenplan_id=${wochenplanId}`)
      if (!res.ok) throw new Error('Konnte Liste nicht laden')
      setListe(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }, [wochenplanId])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => setVisible(true))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    laden()
    return () => {
      document.removeEventListener('keydown', onKey)
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [onClose, laden])

  const editable = liste !== null && liste.gesendet_am === null
  const bestellt = bestellStatus?.status === 'bestellt'
  const fehlendeSet = new Set(bestellStatus?.fehlende_produkte ?? [])

  async function toggleGestrichen(name: string) {
    if (!liste) return
    const aktuellGestrichen = liste.gestrichen.includes(name)
    // Optimistic update
    setListe({
      ...liste,
      gestrichen: aktuellGestrichen
        ? liste.gestrichen.filter(n => n !== name)
        : [...liste.gestrichen, name],
    })
    try {
      await apiFetch('/api/einkaufsliste/streichen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wochenplan_id: wochenplanId,
          zutatName: name,
          streichen: !aktuellGestrichen,
        }),
      })
    } catch {
      // Revert on error
      laden()
    }
  }

  async function senden() {
    setSending(true)
    try {
      const res = await apiFetch('/api/einkaufsliste/senden', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Senden fehlgeschlagen')
      }
      await laden()
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setSending(false)
    }
  }

  function handleTouchStart(e: React.TouchEvent) { touchStartY.current = e.touches[0].clientY }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    if (e.touches[0].clientY - touchStartY.current > 80) { touchStartY.current = null; onClose() }
  }
  function handleTouchEnd() { touchStartY.current = null }

  const gestrichen = new Set(liste?.gestrichen ?? [])
  const anzahlGestrichen = gestrichen.size

  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="einkauf-title"
        className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-3xl overflow-hidden"
        style={{
          background: '#ffffff',
          maxHeight: '85vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <div className="flex justify-center pt-3 pb-1" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(85vh - 40px)' }}>
          <div className="mt-2 mb-5">
            <h2 id="einkauf-title" className="text-lg font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
              Einkaufsliste
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-secondary)' }}>
              {statusText(liste, bestellt)}
            </p>
          </div>

          {loading && <p className="text-sm py-8 text-center" style={{ color: 'var(--gray-secondary)' }}>Lädt …</p>}
          {error && <p className="text-sm px-3 py-2 rounded-xl mb-3" style={{ background: '#fff0f3', color: 'var(--rausch)' }}>{error}</p>}

          {liste && liste.picnic.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#f0fae8' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#5ba832', color: '#ffffff', fontSize: '10px' }}>Picnic</span>
                <span className="text-xs font-semibold" style={{ color: '#5ba832' }}>{liste.picnic.length} Artikel</span>
              </div>
              {bestellt && (bestellStatus?.fehlende_produkte?.length ?? 0) > 0 && (
                <p className="text-xs mb-2 px-2 py-1 rounded" style={{ background: '#fffbeb', color: '#92400e' }}>
                  ⚠ {bestellStatus!.fehlende_produkte!.length} Artikel möglicherweise nicht dabei
                </p>
              )}
              <ul className="space-y-0.5">
                {liste.picnic.map((item, i) => (
                  <ZeilePicnic
                    key={i}
                    item={item}
                    gestrichen={gestrichen.has(item.picnicProdukt)}
                    bestellt={bestellt && !fehlendeSet.has(item.picnicProdukt)}
                    fehlt={bestellt && fehlendeSet.has(item.picnicProdukt)}
                    onToggle={() => toggleGestrichen(item.picnicProdukt)}
                    editable={editable}
                  />
                ))}
              </ul>
            </div>
          )}

          {liste && liste.bring1.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}>Bring · Einkauf 1</span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>{liste.bring1.length} Artikel</span>
              </div>
              <ul className="space-y-0.5">
                {liste.bring1.map((item, i) => (
                  <ZeileBring
                    key={i}
                    item={item}
                    gestrichen={gestrichen.has(item.name)}
                    onToggle={() => toggleGestrichen(item.name)}
                    editable={editable}
                  />
                ))}
              </ul>
            </div>
          )}

          {liste && liste.bring2.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}>Bring · Einkauf 2</span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>{liste.bring2.length} Artikel</span>
              </div>
              <ul className="space-y-0.5">
                {liste.bring2.map((item, i) => (
                  <ZeileBring
                    key={i}
                    item={item}
                    gestrichen={gestrichen.has(item.name)}
                    onToggle={() => toggleGestrichen(item.name)}
                    editable={editable}
                  />
                ))}
              </ul>
            </div>
          )}

          {liste && liste.aus_vorrat.length > 0 && (
            <div className="rounded-xl p-3 mb-5" style={{ background: '#f5f5f5' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#888888', color: '#ffffff', fontSize: '10px' }}>Aus dem Vorrat</span>
                <span className="text-xs font-semibold" style={{ color: '#888888' }}>{liste.aus_vorrat.length} Artikel</span>
              </div>
              <ul className="space-y-0.5">
                {liste.aus_vorrat.map((item, i) => (
                  <li key={i} className="text-sm flex items-baseline gap-2 py-1" style={{ color: 'var(--near-black)' }}>
                    <span style={{ color: '#888888', flexShrink: 0 }}>·</span>
                    <span className="flex-1">{item.name}</span>
                    {item.menge > 0 && (
                      <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>{item.menge} {item.einheit}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editable && liste && (
            <div className="mt-4">
              {anzahlGestrichen > 0 && (
                <p className="text-xs mb-2 text-center" style={{ color: 'var(--gray-secondary)' }}>
                  {anzahlGestrichen} {anzahlGestrichen === 1 ? 'Zutat wird' : 'Zutaten werden'} nicht gesendet
                </p>
              )}
              <button
                onClick={senden}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
                style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '52px' }}
              >
                {sending ? 'Sende …' : 'An Picnic + Bring senden'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Schritt 2: Typescheck**

Run: `cd app && npx tsc --noEmit`
Expected: Keine neuen Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add app/components/EinkaufslisteSheet.tsx
git commit -m "feat(sheet): kontextsensitive Einkaufsliste mit Streichen + Senden"
```

---

## Task 15: Wochenplan-Page anpassen

**Files:**
- Modify: `app/app/wochenplan/page.tsx`

Aufräumen: sessionStorage weg, ein-Button-Logik, Bestellstatus-Banner wandert in Sheet (wird als Prop weitergegeben), Sync-Retry-Aufruf beim Mount, Toasts bei Diff-Update.

- [ ] **Schritt 1: Page neu schreiben**

Ersetze den kompletten Inhalt von `app/app/wochenplan/page.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WochenplanGrid } from '@/components/WochenplanGrid'
import { RezeptSheet } from '@/components/RezeptSheet'
import { ExtrasRezeptSheet } from '@/components/ExtrasRezeptSheet'
import { EinkaufslisteSheet } from '@/components/EinkaufslisteSheet'
import { apiFetch } from '@/lib/api-fetch'
import { SONDERKATEGORIEN } from '@/lib/sonderkategorien'
import type { Wochenplan, Gericht, ExtrasWochenplanEintrag, Einkaufsliste, ListenDiff, WochenplanEintrag } from '@/types'

function buildDiffToast(diff: ListenDiff): string | null {
  const parts: string[] = []
  for (const [sektion, sektionDiff] of Object.entries(diff) as Array<['picnic' | 'bring1' | 'bring2', { hinzu: Array<{ name?: string; picnicProdukt?: string }>; weg: Array<{ name?: string; picnicProdukt?: string }> }]>) {
    if (!sektionDiff) continue
    const label = sektion === 'bring1' ? 'Bring-Einkauf 1' : sektion === 'bring2' ? 'Bring-Einkauf 2' : 'Picnic'
    const hinzuNames = sektionDiff.hinzu.map(i => (i.picnicProdukt ?? i.name ?? '')).filter(Boolean)
    const wegNames = sektionDiff.weg.map(i => (i.picnicProdukt ?? i.name ?? '')).filter(Boolean)
    const parts2: string[] = []
    if (hinzuNames.length) parts2.push('+' + hinzuNames.join(', '))
    if (wegNames.length) parts2.push('−' + wegNames.join(', '))
    if (parts2.length) parts.push(`${label} aktualisiert: ${parts2.join(' ')}`)
  }
  return parts.length ? parts.join(' · ') : null
}

export default function WochenplanPage() {
  const router = useRouter()
  const [carryOverPlan, setCarryOverPlan] = useState<Wochenplan | null>(null)
  const [aktiverPlan, setAktiverPlan] = useState<Wochenplan | null>(null)
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listenStatus, setListenStatus] = useState<Einkaufsliste | null>(null)
  const [einkaufslisteOffen, setEinkaufslisteOffen] = useState(false)
  const [rezeptGericht, setRezeptGericht] = useState<Gericht | null>(null)
  const [extras, setExtras] = useState<ExtrasWochenplanEintrag[]>([])
  const [carryOverExtras, setCarryOverExtras] = useState<ExtrasWochenplanEintrag[]>([])
  const [rezeptExtra, setRezeptExtra] = useState<ExtrasWochenplanEintrag | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const extrasGenerierenLaeuft = useRef(false)
  const [bestellStatus, setBestellStatus] = useState<{
    status: 'offen' | 'bestellt' | 'keine_liste' | 'kein_plan'
    fehlende_produkte?: string[]
    gesendete_anzahl?: number
  } | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function ladeListenStatus(planId: string) {
    try {
      const res = await apiFetch(`/api/einkaufsliste?wochenplan_id=${planId}`)
      if (res.ok) setListenStatus(await res.json())
    } catch { /* ignore */ }
  }

  async function versucheSyncRetry(planId: string) {
    try {
      const res = await apiFetch('/api/einkaufsliste/sync-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wochenplan_id: planId }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.retried) {
        showToast('Einkaufsliste wieder synchron')
        await ladeListenStatus(planId)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    apiFetch('/api/gerichte').then(r => r.json()).then(setGerichte).catch(() => setError('Gerichte konnten nicht geladen werden'))
    apiFetch('/api/wochenplan')
      .then(r => r.ok ? r.json() : null)
      .then((data: { carryOverPlan: Wochenplan | null; aktiverPlan: Wochenplan | null } | null) => {
        if (!data) return
        setCarryOverPlan(data.carryOverPlan)
        setAktiverPlan(data.aktiverPlan)
        if (data.aktiverPlan?.id) {
          const planId = data.aktiverPlan.id
          ladeListenStatus(planId)
          versucheSyncRetry(planId)
          apiFetch(`/api/extras?wochenplan_id=${planId}`).then(r => r.ok ? r.json() : []).then(async (geladen: ExtrasWochenplanEintrag[]) => {
            if (geladen.length > 0) { setExtras(geladen); return }
            if (extrasGenerierenLaeuft.current) return
            extrasGenerierenLaeuft.current = true
            try {
              const gen = await apiFetch('/api/extras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wochenplan_id: planId }),
              })
              setExtras(gen.ok ? await gen.json() : [])
            } finally { extrasGenerierenLaeuft.current = false }
          }).catch(e => console.warn('Extras konnten nicht geladen werden', e))
          apiFetch('/api/picnic/bestellung-status').then(r => r.ok ? r.json() : null).then(d => { if (d) setBestellStatus(d) }).catch(() => {})
        }
        if (data.carryOverPlan?.id) {
          apiFetch(`/api/extras?wochenplan_id=${data.carryOverPlan.id}`).then(r => r.ok ? r.json() : []).then(setCarryOverExtras).catch(() => {})
        }
      })
      .catch(() => setError('Wochenplan konnte nicht geladen werden'))
  }, [])

  async function generieren() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/wochenplan/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Fehler beim Generieren')
      setAktiverPlan(data)
      if (data?.id) {
        ladeListenStatus(data.id)
        apiFetch(`/api/extras?wochenplan_id=${data.id}`).then(r => r.ok ? r.json() : []).then(setExtras).catch(() => {})
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally { setLoading(false) }
  }

  async function tauschOderWaehle(body: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' }, planId: string) {
    const res = await apiFetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen')
    const data = await res.json()
    setAktiverPlan(data)
    if (data.einkaufslisten_diff) {
      const msg = buildDiffToast(data.einkaufslisten_diff as ListenDiff)
      if (msg) showToast(msg)
    }
    await ladeListenStatus(planId)
  }

  async function tauschen(tag: string, mahlzeit: string) {
    if (!aktiverPlan) return
    const aktuell = aktiverPlan.eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const sonderKategorie = mahlzeit === 'frühstück'
      ? 'frühstück'
      : SONDERKATEGORIEN[`${tag}-${mahlzeit}`] ?? null
    const andere = gerichte.filter(g =>
      g.id !== aktuell?.gericht_id &&
      !g.gesperrt &&
      (sonderKategorie
        ? g.kategorie === sonderKategorie
        : g.kategorie !== 'frühstück' && g.kategorie !== 'trainingstage' && g.kategorie !== 'filmabend')
    )
    const neu = andere[Math.floor(Math.random() * andere.length)]
    if (!neu) return
    const slotExistiert = aktiverPlan.eintraege.some(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const eintraege = slotExistiert
      ? aktiverPlan.eintraege.map(e => e.tag === tag && e.mahlzeit === mahlzeit ? { ...e, gericht_id: neu.id, gericht_name: neu.name } : e)
      : [...aktiverPlan.eintraege, { tag: tag as WochenplanEintrag['tag'], mahlzeit: mahlzeit as WochenplanEintrag['mahlzeit'], gericht_id: neu.id, gericht_name: neu.name }]
    try {
      await tauschOderWaehle({ eintraege, status: aktiverPlan.status }, aktiverPlan.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Tauschen fehlgeschlagen')
      return
    }
    if (aktuell?.gericht_id) {
      apiFetch(`/api/gerichte/${aktuell.gericht_id}/tauschen`, { method: 'PATCH' }).catch(() => {})
    }
  }

  async function waehlen(tag: string, mahlzeit: string, gericht: Gericht) {
    if (!aktiverPlan) return
    const slotExistiert = aktiverPlan.eintraege.some(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const eintraege = slotExistiert
      ? aktiverPlan.eintraege.map(e => e.tag === tag && e.mahlzeit === mahlzeit ? { ...e, gericht_id: gericht.id, gericht_name: gericht.name } : e)
      : [...aktiverPlan.eintraege, { tag: tag as WochenplanEintrag['tag'], mahlzeit: mahlzeit as WochenplanEintrag['mahlzeit'], gericht_id: gericht.id, gericht_name: gericht.name }]
    try {
      await tauschOderWaehle({ eintraege, status: aktiverPlan.status }, aktiverPlan.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Auswahl fehlgeschlagen')
    }
  }

  async function genehmigen() {
    if (!aktiverPlan) return
    try {
      await tauschOderWaehle({ eintraege: aktiverPlan.eintraege, status: 'genehmigt' }, aktiverPlan.id)
      showToast('Einkaufsliste bereit')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Genehmigen fehlgeschlagen')
    }
  }

  const hatPlan = carryOverPlan !== null || aktiverPlan !== null
  const istFreitag = new Date().getDay() === 5
  const buttonStatusSuffix = (() => {
    if (!listenStatus) return ''
    if (bestellStatus?.status === 'bestellt') {
      const fehlt = (bestellStatus.fehlende_produkte?.length ?? 0) > 0
      return fehlt ? '· Bestellt (teilweise)' : '· Bestellt'
    }
    if (listenStatus.gesendet_am) return '· Gesendet'
    return '· Entwurf'
  })()

  return (
    <main className="min-h-screen bg-white pb-32">
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
            Diese Woche
          </h1>
          <button
            onClick={() => router.push('/wochenplan/uebersicht')}
            aria-label="Wochenplan Gesamtansicht"
            className="w-10 h-10 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--near-black)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm" style={{ color: aktiverPlan?.status === 'entwurf' ? 'var(--rausch)' : aktiverPlan?.status === 'genehmigt' ? '#00a651' : 'var(--gray-secondary)' }}>
            {aktiverPlan
              ? aktiverPlan.status === 'genehmigt' ? '✓ Genehmigt' : 'Entwurf — nicht genehmigt'
              : carryOverPlan ? 'Nächste Woche noch nicht geplant' : 'Noch kein Plan für diese Woche'}
          </p>
          {aktiverPlan?.status === 'entwurf' && (
            <button onClick={genehmigen} className="flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5 active:opacity-70 transition-opacity" style={{ background: '#00a651', color: '#ffffff' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Genehmigen
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#fff0f3', color: 'var(--rausch)' }}>{error}</p>}
      </div>

      {hatPlan ? (
        <WochenplanGrid
          carryOverPlan={carryOverPlan}
          aktiverPlan={aktiverPlan}
          gerichte={gerichte}
          extras={extras}
          carryOverExtras={carryOverExtras}
          onTauschen={tauschen}
          onWaehlen={waehlen}
          onRezept={setRezeptGericht}
          onExtrasRezept={setRezeptExtra}
        />
      ) : (
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--near-black)' }}>Noch kein Plan</p>
          <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
            {istFreitag ? 'Tippe unten auf "Plan erstellen"' : 'Am Freitag kann Jarvis einen neuen Plan erstellen'}
          </p>
        </div>
      )}

      <div className="fixed left-0 right-0 px-4 pb-2 pt-3 z-50" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 34px))', background: 'linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0))' }}>
        <div className="flex flex-col gap-2">
          {istFreitag && (
            <button onClick={generieren} disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity" style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '52px' }}>
              {loading ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Plan für nächste Woche erstellen
                </>
              )}
            </button>
          )}

          {aktiverPlan?.status === 'genehmigt' && (
            <button
              onClick={() => setEinkaufslisteOffen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
              style={{ background: 'var(--near-black)', color: '#ffffff', minHeight: '52px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Einkaufsliste {buttonStatusSuffix}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-medium z-[70]" style={{ bottom: 'calc(140px + env(safe-area-inset-bottom, 34px))', background: 'var(--near-black)', color: '#ffffff', maxWidth: '90%' }}>
          {toast}
        </div>
      )}

      {rezeptGericht?.rezept && (
        <RezeptSheet gericht={rezeptGericht as Gericht & { rezept: NonNullable<Gericht['rezept']> }} onClose={() => setRezeptGericht(null)} />
      )}
      {rezeptExtra && <ExtrasRezeptSheet extra={rezeptExtra} onClose={() => setRezeptExtra(null)} />}
      {einkaufslisteOffen && aktiverPlan && (
        <EinkaufslisteSheet
          wochenplanId={aktiverPlan.id}
          bestellStatus={bestellStatus}
          onClose={() => { setEinkaufslisteOffen(false); ladeListenStatus(aktiverPlan.id) }}
          onSent={() => { ladeListenStatus(aktiverPlan.id) }}
        />
      )}
    </main>
  )
}
```

- [ ] **Schritt 2: Typescheck + Build**

Run: `cd app && npx tsc --noEmit`
Expected: Keine Fehler.

Run: `cd app && npm run build`
Expected: Build erfolgreich.

- [ ] **Schritt 3: Commit**

```bash
git add app/app/wochenplan/page.tsx
git commit -m "feat(wochenplan-page): Button-Logik vereinfacht, Toasts, Sync-Retry"
```

---

## Task 16: Manueller End-to-End-Test

**Files:** Keine neuen Dateien — reiner Funktionstest.

Dies ist ein Verifizierungs-Task, der die wichtigsten Lebenszyklus-Transitions in der laufenden App nachstellt. Erfordert lokales Setup mit echten API-Zugängen (Bring, Picnic, Supabase-Staging-DB).

- [ ] **Schritt 1: Dev-Server starten**

Run: `cd app && npm run dev`
Expected: Server startet auf http://localhost:3000.

- [ ] **Schritt 2: Test-Plan abarbeiten**

Die folgenden Szenarien manuell durchspielen und bei jedem Schritt beobachten, ob UI und DB die erwarteten Zustände zeigen:

1. **Plan-Genehmigung → Liste-Berechnung:** 
   - Plan generieren (Freitag-Simulation über System-Zeit oder Datum-Utils-Mock).
   - Genehmigen klicken.
   - Erwarten: Toast "Einkaufsliste bereit", Button wechselt zu *"Einkaufsliste · Entwurf"*.
   - DB-Check: `select gesendet_am, picnic, bring1, bring2 from einkaufslisten where wochenplan_id = ...` — `gesendet_am = null`, Sektionen befüllt.

2. **Sheet öffnen + Streichen:**
   - Sheet öffnen, beliebige Zutat streichen.
   - Erwarten: Zutat durchgestrichen, Hinweis "1 Zutat wird nicht gesendet".
   - DB-Check: `gestrichen`-Array enthält Zutat.
   - Zutat wiederherstellen → `gestrichen` leer.

3. **Senden:**
   - Senden klicken.
   - Erwarten: Loading-State, nach Erfolg Sheet zeigt *"Gesendet am ..."*, Button *"Einkaufsliste · Gesendet"*.
   - DB-Check: `gesendet_am` gesetzt, `gesendet_snapshot` gefüllt.
   - Bring-App prüfen: Beide Listen gefüllt. Picnic-App: Warenkorb gefüllt.

4. **Tausch vor Senden (Entwurf):**
   - Plan zurück auf `entwurf` (manuell via Supabase), dann Gericht tauschen.
   - Erwarten: Kein Toast, aber Liste in DB neu berechnet.

5. **Tausch nach Senden, offene Bring-2:**
   - System-Datum auf Dienstag setzen (oder Mock).
   - Donnerstags-Gericht tauschen.
   - Erwarten: Toast "Bring-Einkauf 2 aktualisiert: +X, −Y", Bring-App zeigt neue Liste.
   - DB-Check: `gesendet_snapshot.bring2` aktualisiert, `bring2`-Spalte aktualisiert.

6. **Tausch mit Picnic-Bestellung aktiv:**
   - `picnic_bestellung_status.bestellung_erkannt = true` setzen.
   - Gericht tauschen das Picnic-Zutaten hätte.
   - Erwarten: Nur Bring-2 wird aktualisiert, Picnic unberührt.

7. **Sync-Fehler-Simulation:**
   - BRING_PASSWORD temporär ungültig setzen, tauschen.
   - Erwarten: DB hat `sync_fehler` gefüllt.
   - App neu laden (BRING_PASSWORD wieder korrekt).
   - Erwarten: Auto-Retry läuft, Toast "Einkaufsliste wieder synchron", `sync_fehler = null`.

- [ ] **Schritt 3: Commit nur falls Bugs gefixt**

Falls bei diesem Test Issues gefunden werden: Fix + Commit. Falls alles clean läuft: kein Commit nötig.

---

## Offene Aufräum-Arbeiten (nicht Teil dieses Plans)

- Die alte `artikel jsonb`-Spalte in `einkaufslisten` wird nicht mehr genutzt. In einer späteren Migration droppen.
- Die Einkaufstage werden derzeit aus `process.env.EINKAUFSTAG_1/2` gelesen, obwohl in `einstellungen`-Tabelle vorhanden. Später harmonisieren (Consistency-Aufgabe, kein Bug).

