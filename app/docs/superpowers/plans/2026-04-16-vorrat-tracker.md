# Vorrat-Tracker — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatisches Bestandstracking für Vorratsgüter (haltbarkeit_tage ≥ 14) — beim Einkaufslisten-Senden werden Picnic-Produktnamen gespeichert, der Vorrat eingebucht/abgezogen, und Artikel mit ausreichendem Bestand aus der Einkaufsliste herausgefiltert.

**Architecture:** Neue Supabase-Tabelle `vorrat`. `lib/vorrat.ts` kapselt Einheitenkonvertierung, Parsing und DB-Zugriffe. `generiereEinkaufslisten` bekommt Vorrat-Daten und gibt `ausVorrat`-Liste zurück. Die `/api/einkaufsliste/senden`-Route lädt Vorrat, übergibt ihn, und aktualisiert ihn nach dem Senden. `EinkaufslisteSheet` zeigt Picnic-Produktnamen + neue "Aus dem Vorrat"-Sektion.

**Tech Stack:** Next.js App Router, Supabase (supabase-js), TypeScript, Jest + @testing-library/react

---

## Dateistruktur

| Datei | Aktion |
|-------|--------|
| `types/index.ts` | Modify — `VorratEintrag`, `NormierteMenge`, `ausVorrat` in `EinkaufslistenErgebnis` |
| `lib/vorrat.ts` | Create — `istTracked`, `normalisiereEinheit`, `parsePaketgroesse`, `ladeVorrat`, `aktualisiereVorrat` |
| `__tests__/lib/vorrat.test.ts` | Create — Tests für alle Funktionen |
| `lib/einkaufsliste.ts` | Modify — vorrat-Parameter + ausVorrat-Output |
| `__tests__/lib/einkaufsliste.test.ts` | Modify — Tests für Vorrat-Filterung ergänzen |
| `app/api/einkaufsliste/senden/route.ts` | Modify — Vorrat laden, Picnic-Produktnamen, Vorrat aktualisieren |
| `components/EinkaufslisteSheet.tsx` | Modify — neues Datenformat + Aus-dem-Vorrat-Sektion |

---

## Task 1: Neue Typen

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Typen ergänzen**

In `types/index.ts` direkt nach dem `EinkaufsRouting`-Interface einfügen:

```ts
export interface NormierteMenge {
  wert: number
  basis: 'g' | 'ml' | 'stueck'
}

export interface VorratEintrag {
  zutat_name: string        // normalisiert: lowercase
  bestand: number
  einheit_basis: 'g' | 'ml' | 'stueck'
}
```

Das bestehende `EinkaufslistenErgebnis`-Interface anpassen (war `einkauf1 + einkauf2`, bekommt `ausVorrat`):

```ts
export interface EinkaufslistenErgebnis {
  einkauf1: EinkaufsItem[]
  einkauf2: EinkaufsItem[]
  ausVorrat: EinkaufsItem[]
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler (Bestehende Destructuring `{ einkauf1, einkauf2 }` bleibt valide — neues Feld ist additiv).

- [ ] **Step 3: Committen**

```bash
git add types/index.ts
git commit -m "feat: VorratEintrag und NormierteMenge Typen, EinkaufslistenErgebnis um ausVorrat erweitert"
```

---

## Task 2: `lib/vorrat.ts` — Reine Hilfsfunktionen

**Files:**
- Create: `lib/vorrat.ts` (nur pure functions, kein Supabase)
- Create: `__tests__/lib/vorrat.test.ts`

- [ ] **Step 1: Failing Tests schreiben**

Erstelle `__tests__/lib/vorrat.test.ts`:

```ts
import { istTracked, normalisiereEinheit, parsePaketgroesse } from '@/lib/vorrat'

describe('istTracked', () => {
  it('gibt false für haltbarkeit < 14', () => {
    expect(istTracked(13)).toBe(false)
    expect(istTracked(7)).toBe(false)
    expect(istTracked(0)).toBe(false)
  })

  it('gibt true für haltbarkeit >= 14', () => {
    expect(istTracked(14)).toBe(true)
    expect(istTracked(30)).toBe(true)
    expect(istTracked(365)).toBe(true)
  })
})

describe('normalisiereEinheit', () => {
  it('g bleibt g', () => {
    expect(normalisiereEinheit(500, 'g')).toEqual({ wert: 500, basis: 'g' })
  })

  it('kg wird zu g', () => {
    expect(normalisiereEinheit(1, 'kg')).toEqual({ wert: 1000, basis: 'g' })
    expect(normalisiereEinheit(0.5, 'kg')).toEqual({ wert: 500, basis: 'g' })
  })

  it('ml bleibt ml', () => {
    expect(normalisiereEinheit(250, 'ml')).toEqual({ wert: 250, basis: 'ml' })
  })

  it('l wird zu ml', () => {
    expect(normalisiereEinheit(1, 'l')).toEqual({ wert: 1000, basis: 'ml' })
  })

  it('cl wird zu ml', () => {
    expect(normalisiereEinheit(10, 'cl')).toEqual({ wert: 100, basis: 'ml' })
  })

  it('TL wird zu g (5g pro TL)', () => {
    expect(normalisiereEinheit(1, 'TL')).toEqual({ wert: 5, basis: 'g' })
    expect(normalisiereEinheit(2, 'TL')).toEqual({ wert: 10, basis: 'g' })
  })

  it('EL wird zu g (15g pro EL)', () => {
    expect(normalisiereEinheit(1, 'EL')).toEqual({ wert: 15, basis: 'g' })
    expect(normalisiereEinheit(3, 'EL')).toEqual({ wert: 45, basis: 'g' })
  })

  it('Stück, Bund, Packung werden zu stueck', () => {
    expect(normalisiereEinheit(2, 'Stück')).toEqual({ wert: 2, basis: 'stueck' })
    expect(normalisiereEinheit(1, 'Bund')).toEqual({ wert: 1, basis: 'stueck' })
    expect(normalisiereEinheit(3, 'Packung')).toEqual({ wert: 3, basis: 'stueck' })
  })

  it('unbekannte Einheit wird zu stueck', () => {
    expect(normalisiereEinheit(1, 'Portion')).toEqual({ wert: 1, basis: 'stueck' })
  })

  it('Einheit ist case-insensitiv', () => {
    expect(normalisiereEinheit(1, 'tl')).toEqual({ wert: 5, basis: 'g' })
    expect(normalisiereEinheit(1, 'G')).toEqual({ wert: 1, basis: 'g' })
  })
})

describe('parsePaketgroesse', () => {
  it('erkennt Gramm', () => {
    expect(parsePaketgroesse('FUCHS Kreuzkümmel gemahlen 35g')).toEqual({ wert: 35, basis: 'g' })
    expect(parsePaketgroesse('Barilla Spaghetti 500g')).toEqual({ wert: 500, basis: 'g' })
  })

  it('erkennt Milliliter', () => {
    expect(parsePaketgroesse('Bertolli Olivenöl extra vergine 500ml')).toEqual({ wert: 500, basis: 'ml' })
  })

  it('erkennt Liter', () => {
    expect(parsePaketgroesse('Milch 3,5% Fett 1l')).toEqual({ wert: 1000, basis: 'ml' })
  })

  it('erkennt Kilogramm', () => {
    expect(parsePaketgroesse('Zucker 1kg')).toEqual({ wert: 1000, basis: 'g' })
  })

  it('gibt null zurück wenn keine Größe erkennbar', () => {
    expect(parsePaketgroesse('Netto Eier 6er Pack')).toBeNull()
    expect(parsePaketgroesse('Brot')).toBeNull()
  })

  it('verarbeitet Kommazahlen', () => {
    expect(parsePaketgroesse('Olivenöl 0,5l')).toEqual({ wert: 500, basis: 'ml' })
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen FAIL sein**

```bash
npx jest __tests__/lib/vorrat.test.ts --no-coverage
```

Erwartet: FAIL mit `Cannot find module '@/lib/vorrat'`

- [ ] **Step 3: Implementation schreiben**

Erstelle `lib/vorrat.ts`:

```ts
import type { NormierteMenge, VorratEintrag } from '@/types'
import { supabase } from '@/lib/supabase-server'

export function istTracked(haltbarkeitTage: number): boolean {
  return haltbarkeitTage >= 14
}

export function normalisiereEinheit(menge: number, einheit: string): NormierteMenge {
  switch (einheit.toLowerCase().trim()) {
    case 'g':       return { wert: menge,         basis: 'g' }
    case 'kg':      return { wert: menge * 1000,  basis: 'g' }
    case 'ml':      return { wert: menge,          basis: 'ml' }
    case 'l':       return { wert: menge * 1000,  basis: 'ml' }
    case 'cl':      return { wert: menge * 10,    basis: 'ml' }
    case 'tl':      return { wert: menge * 5,     basis: 'g' }
    case 'el':      return { wert: menge * 15,    basis: 'g' }
    default:        return { wert: menge,          basis: 'stueck' }
  }
}

export function parsePaketgroesse(produktName: string): NormierteMenge | null {
  const match = produktName.match(/(\d+(?:[,.]\d+)?)\s*(g|kg|ml|l|cl)\b/i)
  if (!match) return null
  const wert = parseFloat(match[1].replace(',', '.'))
  return normalisiereEinheit(wert, match[2].toLowerCase())
}

export async function ladeVorrat(): Promise<VorratEintrag[]> {
  const { data } = await supabase
    .from('vorrat')
    .select('zutat_name, bestand, einheit_basis')
  return (data ?? []) as VorratEintrag[]
}

export async function aktualisiereVorrat(
  aktuellerVorrat: VorratEintrag[],
  kaeufe: Array<{ zutat_name: string; paket: NormierteMenge | null; verbrauch: NormierteMenge }>,
  ausVorratListe: Array<{ zutat_name: string; verbrauch: NormierteMenge }>
): Promise<void> {
  try {
    const map = new Map<string, VorratEintrag>()
    for (const v of aktuellerVorrat) {
      map.set(v.zutat_name, { ...v })
    }

    for (const kauf of kaeufe) {
      const key = kauf.zutat_name
      const basis = kauf.paket?.basis ?? kauf.verbrauch.basis
      const existing = map.get(key)
      let bestand = existing?.bestand ?? 0

      if (kauf.paket && (!existing || existing.einheit_basis === kauf.paket.basis)) {
        bestand += kauf.paket.wert
      }
      bestand -= kauf.verbrauch.wert
      if (bestand < 0) bestand = 0

      map.set(key, {
        zutat_name: key,
        bestand,
        einheit_basis: existing?.einheit_basis ?? basis,
      })
    }

    for (const av of ausVorratListe) {
      const key = av.zutat_name
      const existing = map.get(key)
      if (!existing) continue
      let bestand = existing.bestand - av.verbrauch.wert
      if (bestand < 0) bestand = 0
      map.set(key, { ...existing, bestand })
    }

    const updates = Array.from(map.values())
    if (updates.length === 0) return

    await supabase
      .from('vorrat')
      .upsert(
        updates.map(v => ({ ...v, aktualisiert_am: new Date().toISOString() })),
        { onConflict: 'zutat_name' }
      )
  } catch {
    // Vorrat-Fehler dürfen nie den Hauptflow unterbrechen
  }
}
```

- [ ] **Step 4: Tests ausführen — müssen PASS sein**

```bash
npx jest __tests__/lib/vorrat.test.ts --no-coverage
```

Erwartet: `istTracked`: 2/2, `normalisiereEinheit`: 9/9, `parsePaketgroesse`: 6/6 PASS

- [ ] **Step 5: Committen**

```bash
git add lib/vorrat.ts __tests__/lib/vorrat.test.ts
git commit -m "feat: lib/vorrat — istTracked, normalisiereEinheit, parsePaketgroesse, ladeVorrat, aktualisiereVorrat"
```

---

## Task 3: DB-Migration (vorrat-Tabelle)

**Files:**
- Create (temp): `scripts/migrate-vorrat.ts`

- [ ] **Step 1: Migrationsskript erstellen**

Erstelle `scripts/migrate-vorrat.ts`:

```ts
import { Client } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL fehlt')

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function run() {
  await client.connect()
  await client.query(`
    CREATE TABLE IF NOT EXISTS vorrat (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      zutat_name      text NOT NULL UNIQUE,
      bestand         numeric NOT NULL DEFAULT 0,
      einheit_basis   text NOT NULL CHECK (einheit_basis IN ('g', 'ml', 'stueck')),
      aktualisiert_am timestamptz NOT NULL DEFAULT now()
    )
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS vorrat_zutat_name_idx ON vorrat (zutat_name)
  `)
  console.log('✅ Tabelle vorrat erstellt (oder bereits vorhanden)')
  await client.end()
}

run().catch(e => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: DATABASE_URL aus Coolify laden**

```bash
curl -s -H "Authorization: Bearer 1|ifb2KsFvEc2olgSEuYYhDHltgnXgEPsYZnJgVkYk02033322" \
  "http://140.82.38.192:8000/api/v1/applications/shpiw0907aj8qielobtzhxt8/envs" \
  | python3 -c "import sys,json; envs=json.load(sys.stdin); [print(e['value']) for e in envs if e['key']=='DATABASE_URL']"
```

Den ausgegebenen Wert für den nächsten Schritt verwenden.

- [ ] **Step 3: Migration ausführen**

```bash
DATABASE_URL="<wert-aus-step-2>" npx tsx scripts/migrate-vorrat.ts
```

Erwartet: `✅ Tabelle vorrat erstellt (oder bereits vorhanden)`

- [ ] **Step 4: Skript löschen + committen**

```bash
rm scripts/migrate-vorrat.ts
git add -A
git commit -m "feat: Supabase-Tabelle vorrat anlegen"
```

---

## Task 4: `ladeVorrat` und `aktualisiereVorrat` — Tests mit gemocktem Supabase

**Files:**
- Modify: `__tests__/lib/vorrat.test.ts`

- [ ] **Step 1: Supabase-Tests ergänzen**

In `__tests__/lib/vorrat.test.ts` am ANFANG der Datei (vor den bestehenden imports) folgendes einfügen:

```ts
const mockSelect = jest.fn()
const mockUpsert = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: jest.fn(() => ({ select: mockSelect, upsert: mockUpsert })),
  },
}))
```

Dann am ENDE der Datei (nach den bestehenden describe-Blöcken) einfügen:

```ts
describe('ladeVorrat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('gibt leeren Array zurück wenn Supabase kein data liefert', async () => {
    const { ladeVorrat } = await import('@/lib/vorrat')
    mockSelect.mockResolvedValueOnce({ data: null })
    const result = await ladeVorrat()
    expect(result).toEqual([])
  })

  it('gibt Vorrat-Einträge zurück', async () => {
    const { ladeVorrat } = await import('@/lib/vorrat')
    const eintraege = [
      { zutat_name: 'kreuzkümmel', bestand: 30, einheit_basis: 'g' },
      { zutat_name: 'olivenöl', bestand: 450, einheit_basis: 'ml' },
    ]
    mockSelect.mockResolvedValueOnce({ data: eintraege })
    const result = await ladeVorrat()
    expect(result).toEqual(eintraege)
  })
})

describe('aktualisiereVorrat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('bucht Kauf ein und zieht Verbrauch ab', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    const aktuellerVorrat = [{ zutat_name: 'kreuzkümmel', bestand: 0, einheit_basis: 'g' as const }]
    const kaeufe = [{
      zutat_name: 'kreuzkümmel',
      paket: { wert: 35, basis: 'g' as const },
      verbrauch: { wert: 5, basis: 'g' as const },
    }]
    await aktualisiereVorrat(aktuellerVorrat, kaeufe, [])
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ zutat_name: 'kreuzkümmel', bestand: 30 })]),
      { onConflict: 'zutat_name' }
    )
  })

  it('zieht ausVorrat-Verbrauch ab', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    const aktuellerVorrat = [{ zutat_name: 'olivenöl', bestand: 450, einheit_basis: 'ml' as const }]
    const ausVorratListe = [{ zutat_name: 'olivenöl', verbrauch: { wert: 30, basis: 'ml' as const } }]
    await aktualisiereVorrat(aktuellerVorrat, [], ausVorratListe)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ zutat_name: 'olivenöl', bestand: 420 })]),
      { onConflict: 'zutat_name' }
    )
  })

  it('lässt bestand nicht unter 0 fallen', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    const aktuellerVorrat = [{ zutat_name: 'nudeln', bestand: 3, einheit_basis: 'g' as const }]
    const ausVorratListe = [{ zutat_name: 'nudeln', verbrauch: { wert: 10, basis: 'g' as const } }]
    await aktualisiereVorrat(aktuellerVorrat, [], ausVorratListe)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ zutat_name: 'nudeln', bestand: 0 })]),
      { onConflict: 'zutat_name' }
    )
  })

  it('schluckt Fehler still', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    mockUpsert.mockRejectedValueOnce(new Error('DB down'))
    await expect(
      aktualisiereVorrat([], [{ zutat_name: 'test', paket: null, verbrauch: { wert: 1, basis: 'g' } }], [])
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Tests ausführen**

```bash
npx jest __tests__/lib/vorrat.test.ts --no-coverage
```

Erwartet: Alle Tests PASS (die neuen 6 + die 17 bestehenden aus Task 2)

- [ ] **Step 3: Committen**

```bash
git add __tests__/lib/vorrat.test.ts
git commit -m "test: ladeVorrat und aktualisiereVorrat Tests"
```

---

## Task 5: `lib/einkaufsliste.ts` — Vorrat-Parameter und ausVorrat-Output

**Files:**
- Modify: `lib/einkaufsliste.ts`
- Modify: `__tests__/lib/einkaufsliste.test.ts`

- [ ] **Step 1: Failing Tests ergänzen**

Am Ende von `__tests__/lib/einkaufsliste.test.ts` einfügen:

```ts
describe('generiereEinkaufslisten — Vorrat-Filterung', () => {
  const gewuerzGericht: Gericht = {
    id: 'g5', name: 'Curry', gesund: true, kategorie: 'fleisch',
    beliebtheit: {}, quelle: 'manuell',
    zutaten: [
      { name: 'Kreuzkümmel', menge: 1, einheit: 'TL', haltbarkeit_tage: 365 },
      { name: 'Hähnchenbrust', menge: 500, einheit: 'g', haltbarkeit_tage: 2 },
    ]
  }
  const eintrag: WochenplanEintrag = {
    tag: 'montag', mahlzeit: 'abend', gericht_id: 'g5', gericht_name: 'Curry'
  }

  it('gibt leeres ausVorrat zurück wenn kein Vorrat vorhanden', () => {
    const { ausVorrat } = generiereEinkaufslisten([eintrag], [gewuerzGericht], 4, [], [])
    expect(ausVorrat).toHaveLength(0)
  })

  it('filtert Artikel in ausVorrat wenn Bestand ausreicht', () => {
    const vorrat = [{ zutat_name: 'kreuzkümmel', bestand: 30, einheit_basis: 'g' as const }]
    const { einkauf1, ausVorrat } = generiereEinkaufslisten([eintrag], [gewuerzGericht], 4, [], vorrat)
    // Kreuzkümmel (1 TL = 5g, Vorrat 30g >= 5g) → ausVorrat
    expect(ausVorrat.find(i => i.name === 'Kreuzkümmel')).toBeTruthy()
    expect(einkauf1.find(i => i.name === 'Kreuzkümmel')).toBeUndefined()
    // Hähnchenbrust (haltbarkeit 2 Tage, nicht tracked) → normal in einkauf1
    expect(einkauf1.find(i => i.name === 'Hähnchenbrust')).toBeTruthy()
  })

  it('kauft Artikel wenn Bestand nicht ausreicht', () => {
    const vorrat = [{ zutat_name: 'kreuzkümmel', bestand: 3, einheit_basis: 'g' as const }]
    const { einkauf1, ausVorrat } = generiereEinkaufslisten([eintrag], [gewuerzGericht], 4, [], vorrat)
    // Vorrat 3g < benötigt 5g → kaufen
    expect(einkauf1.find(i => i.name === 'Kreuzkümmel')).toBeTruthy()
    expect(ausVorrat.find(i => i.name === 'Kreuzkümmel')).toBeUndefined()
  })

  it('kauft Artikel wenn Vorrat in anderer Einheit', () => {
    // Vorrat in 'ml', Bedarf in 'g' → kein Match → kaufen
    const vorrat = [{ zutat_name: 'kreuzkümmel', bestand: 100, einheit_basis: 'ml' as const }]
    const { einkauf1, ausVorrat } = generiereEinkaufslisten([eintrag], [gewuerzGericht], 4, [], vorrat)
    expect(einkauf1.find(i => i.name === 'Kreuzkümmel')).toBeTruthy()
    expect(ausVorrat.find(i => i.name === 'Kreuzkümmel')).toBeUndefined()
  })

  it('berücksichtigt aggregierte Menge über mehrere Gerichte', () => {
    const zweitesGericht: Gericht = {
      id: 'g6', name: 'Linsensuppe', gesund: true, kategorie: 'suppe',
      beliebtheit: {}, quelle: 'manuell',
      zutaten: [{ name: 'Kreuzkümmel', menge: 2, einheit: 'TL', haltbarkeit_tage: 365 }]
    }
    const eintraege: WochenplanEintrag[] = [
      eintrag,
      { tag: 'dienstag', mahlzeit: 'abend', gericht_id: 'g6', gericht_name: 'Linsensuppe' }
    ]
    // Gesamt: 3 TL = 15g. Vorrat: 30g → alles aus Vorrat
    const vorrat = [{ zutat_name: 'kreuzkümmel', bestand: 30, einheit_basis: 'g' as const }]
    const { einkauf1, ausVorrat } = generiereEinkaufslisten(eintraege, [gewuerzGericht, zweitesGericht], 4, [], vorrat)
    expect(ausVorrat.find(i => i.name === 'Kreuzkümmel')).toBeTruthy()
    expect(einkauf1.find(i => i.name === 'Kreuzkümmel')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen FAIL sein**

```bash
npx jest __tests__/lib/einkaufsliste.test.ts --no-coverage
```

Erwartet: FAIL — `generiereEinkaufslisten` akzeptiert noch keinen `vorrat`-Parameter und gibt noch kein `ausVorrat` zurück.

- [ ] **Step 3: `lib/einkaufsliste.ts` anpassen**

Am Anfang der Datei nach den bestehenden Imports einfügen:

```ts
import { istTracked, normalisiereEinheit } from '@/lib/vorrat'
import type { VorratEintrag } from '@/types'
```

Die Funktion `generiereEinkaufslisten` bekommt einen neuen optionalen Parameter und eine erweiterte Rückgabe. Vollständiger Ersatz der Funktion (Zeilen 83–140 in `lib/einkaufsliste.ts`):

```ts
export function generiereEinkaufslisten(
  eintraege: WochenplanEintrag[],
  gerichte: Gericht[],
  einkaufstag2: number,
  regelbedarfNamen: string[] = [],
  vorrat: VorratEintrag[] = []
): EinkaufslistenErgebnis {
  const gerichtMap = new Map(gerichte.map(g => [g.name, g]))

  const gerichteNamenMitResten = new Set(
    eintraege
      .filter(e => istReste(e.gericht_name))
      .map(e => basisName(e.gericht_name))
  )

  const relevantEintraege = eintraege.filter(e => !istReste(e.gericht_name))

  const roh1: EinkaufsItem[] = []
  const roh2: EinkaufsItem[] = []
  const trackedNamen = new Set<string>()

  for (const eintrag of relevantEintraege) {
    const gericht = gerichtMap.get(eintrag.gericht_name)
    if (!gericht || gericht.zutaten.length === 0) continue

    if (gericht.zutaten.some(z => z.name === 'Essen wird bestellt')) continue

    const tagIndex = tagZuWochenindex(eintrag.tag)
    if (tagIndex === 0) continue
    const hatReste = gerichteNamenMitResten.has(eintrag.gericht_name)
    const faktor = hatReste ? 2 : 1

    for (const zutat of gericht.zutaten) {
      if (istGrundvorrat(zutat.name)) continue
      if (istInRegelbedarf(zutat.name, regelbedarfNamen)) continue

      const item: EinkaufsItem = {
        name: zutat.name,
        menge: zutat.menge * faktor,
        einheit: zutat.einheit,
      }

      if (istTracked(zutat.haltbarkeit_tage)) {
        trackedNamen.add(zutat.name.toLowerCase())
      }

      if (zutat.haltbarkeit_tage >= 5) {
        roh1.push(item)
      } else if (tagIndex < einkaufstag2) {
        roh1.push(item)
      } else {
        roh2.push(item)
      }
    }
  }

  // Vorrat-Check auf aggregierten einkauf1-Daten
  const einkauf1Aggregiert = aggregiere(roh1)
  const einkauf1Final: EinkaufsItem[] = []
  const ausVorrat: EinkaufsItem[] = []

  if (vorrat.length > 0) {
    const vorratMap = new Map(vorrat.map(v => [v.zutat_name, v]))

    for (const item of einkauf1Aggregiert) {
      const key = item.name.toLowerCase()
      if (trackedNamen.has(key)) {
        const norm = normalisiereEinheit(item.menge, item.einheit)
        const eintragVorrat = vorratMap.get(key)
        if (eintragVorrat && eintragVorrat.einheit_basis === norm.basis && eintragVorrat.bestand >= norm.wert) {
          ausVorrat.push(item)
          continue
        }
      }
      einkauf1Final.push(item)
    }
  } else {
    einkauf1Final.push(...einkauf1Aggregiert)
  }

  return {
    einkauf1: einkauf1Final,
    einkauf2: aggregiere(roh2),
    ausVorrat,
  }
}
```

- [ ] **Step 4: Tests ausführen**

```bash
npx jest __tests__/lib/einkaufsliste.test.ts --no-coverage
```

Erwartet: Alle bestehenden Tests PASS + neue Vorrat-Tests PASS

- [ ] **Step 5: Committen**

```bash
git add lib/einkaufsliste.ts __tests__/lib/einkaufsliste.test.ts
git commit -m "feat: generiereEinkaufslisten mit Vorrat-Filterung und ausVorrat-Output"
```

---

## Task 6: `/api/einkaufsliste/senden/route.ts` anpassen

**Files:**
- Modify: `app/api/einkaufsliste/senden/route.ts`

- [ ] **Step 1: Imports ergänzen**

Am Anfang der Datei nach den bestehenden Imports einfügen:

```ts
import { ladeVorrat, aktualisiereVorrat, parsePaketgroesse, normalisiereEinheit, istTracked } from '@/lib/vorrat'
```

- [ ] **Step 2: `verarbeitePicnicListe` — Produktnamen mitführen**

Das Interface der lokalen gefunden-Einträge und den Return-Type anpassen. Die gesamte `verarbeitePicnicListe`-Funktion ersetzen (aktuell Zeilen 44–77):

```ts
async function verarbeitePicnicListe(
  picnicKandidaten: EinkaufsItem[],
  mindestbestellwert: number
): Promise<{
  zuPicnic: Array<{ item: EinkaufsItem; artikelId: string; picnicProdukt: string }>
  zuBring: EinkaufsItem[]
  gesamtpreisEuro: number
}> {
  const gefunden: Array<{ item: EinkaufsItem; artikelId: string; preisCent: number; picnicProdukt: string }> = []
  const nichtGefunden: EinkaufsItem[] = []

  await Promise.all(
    picnicKandidaten.map(async (item) => {
      const artikel = await sucheArtikel(item.name)
      if (artikel) {
        gefunden.push({ item, artikelId: artikel.artikelId, preisCent: artikel.preis, picnicProdukt: artikel.name })
      } else {
        nichtGefunden.push(item)
      }
    })
  )

  const gesamtpreisEuro = gefunden.reduce((sum, g) => sum + g.preisCent / 100, 0)

  if (gesamtpreisEuro < mindestbestellwert) {
    return {
      zuPicnic: [],
      zuBring: [...picnicKandidaten],
      gesamtpreisEuro,
    }
  }

  return {
    zuPicnic: gefunden.map(g => ({ item: g.item, artikelId: g.artikelId, picnicProdukt: g.picnicProdukt })),
    zuBring: nichtGefunden,
    gesamtpreisEuro,
  }
}
```

- [ ] **Step 3: POST-Handler — Vorrat laden, übergeben, Regelbedarf-Produktnamen, aktualisieren**

Den gesamten `POST`-Handler ersetzen (aktuell Zeilen 85–177). Neuer Handler:

```ts
export async function POST() {
  try {
    const { aktiverPlan: plan } = await ladeWochenAnsicht()
    if (!plan) {
      return NextResponse.json(
        { error: 'Kein Wochenplan für diese Woche gefunden' },
        { status: 404 }
      )
    }

    const [{ data: gerichte }, einstellungen, regelbedarf, vorrat] = await Promise.all([
      supabase.from('gerichte').select('*'),
      ladePicnicEinstellungen(),
      ladeRegelbedarf(),
      ladeVorrat(),
    ])

    if (!gerichte) {
      return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
    }

    const einkaufstag2Raw = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
    const einkaufstag2 = isNaN(einkaufstag2Raw) ? 4 : einkaufstag2Raw
    const regelbedarfNamen = regelbedarf.map(r => r.name)
    const { einkauf1, einkauf2, ausVorrat } = generiereEinkaufslisten(
      plan.eintraege,
      gerichte as Gericht[],
      einkaufstag2,
      regelbedarfNamen,
      vorrat
    )

    const routing1 = splitNachRouting(einkauf1, einstellungen.bringKeywords)
    const picnic1Ergebnis = await verarbeitePicnicListe(routing1.picnic, einstellungen.mindestbestellwert)
    const bring1Gesamt = [...routing1.bring, ...picnic1Ergebnis.zuBring]
    const bring2Gesamt = [...einkauf2]

    const regelbedarfItems: EinkaufsItem[] = regelbedarf.map(r => ({
      name: r.name,
      menge: r.menge,
      einheit: r.einheit,
    }))
    const regelbedarfErgebnisse = await Promise.all(
      regelbedarfItems.map(async (r) => {
        const artikel = await sucheArtikel(r.name)
        return artikel ? { item: r, artikelId: artikel.artikelId, picnicProdukt: artikel.name } : null
      })
    )
    const regelbedarfPicnicItems = regelbedarfErgebnisse.filter(
      (r): r is { item: EinkaufsItem; artikelId: string; picnicProdukt: string } => r !== null
    )

    await warenkorbLeeren()
    await fuellePicnicWarenkorb([
      ...picnic1Ergebnis.zuPicnic,
      ...regelbedarfPicnicItems,
    ])

    const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
    const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'

    await Promise.all([
      mitRetry(() => aktualisiereEinkaufsliste(listName1, bring1Gesamt)),
      mitRetry(() => aktualisiereEinkaufsliste(listName2, bring2Gesamt)),
    ])

    // Vorrat aktualisieren: nur tracked Picnic-Artikel (haltbarkeit >= 14)
    const haltbarkeitMap = new Map<string, number>()
    for (const g of gerichte as Gericht[]) {
      for (const z of g.zutaten) {
        haltbarkeitMap.set(z.name.toLowerCase(), z.haltbarkeit_tage)
      }
    }

    const kaufeFuerVorrat = picnic1Ergebnis.zuPicnic
      .filter(p => istTracked(haltbarkeitMap.get(p.item.name.toLowerCase()) ?? 0))
      .map(p => ({
        zutat_name: p.item.name.toLowerCase(),
        paket: parsePaketgroesse(p.picnicProdukt),
        verbrauch: normalisiereEinheit(p.item.menge, p.item.einheit),
      }))

    const ausVorratFuerUpdate = ausVorrat.map(item => ({
      zutat_name: item.name.toLowerCase(),
      verbrauch: normalisiereEinheit(item.menge, item.einheit),
    }))

    await aktualisiereVorrat(vorrat, kaufeFuerVorrat, ausVorratFuerUpdate)

    const picnicListenItems = [
      ...picnic1Ergebnis.zuPicnic.map(p => ({ picnicProdukt: p.picnicProdukt })),
      ...regelbedarfPicnicItems.map(p => ({ picnicProdukt: p.picnicProdukt })),
    ]

    return NextResponse.json({
      einkauf1Count: bring1Gesamt.length,
      einkauf2Count: bring2Gesamt.length,
      picnic1Count: picnicListenItems.length,
      picnic1Fallback: picnic1Ergebnis.zuPicnic.length === 0 && routing1.picnic.length > 0,
      listen: {
        picnic: picnicListenItems,
        bring1: bring1Gesamt,
        bring2: bring2Gesamt,
        ausVorrat,
      },
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

- [ ] **Step 4: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 5: Alle Tests laufen lassen**

```bash
npx jest --no-coverage
```

Erwartet: Alle Tests PASS.

- [ ] **Step 6: Committen**

```bash
git add app/api/einkaufsliste/senden/route.ts
git commit -m "feat: einkaufsliste/senden mit Vorrat-Integration und Picnic-Produktnamen"
```

---

## Task 7: `EinkaufslisteSheet.tsx` — UI anpassen

**Files:**
- Modify: `components/EinkaufslisteSheet.tsx`

- [ ] **Step 1: `EinkaufslistenDaten`-Interface und Picnic-Sektion anpassen**

Den gesamten Inhalt von `components/EinkaufslisteSheet.tsx` ersetzen:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EinkaufsItem } from '@/types'
import { aggregiere } from '@/lib/einkaufsliste'

export interface EinkaufslistenDaten {
  picnic: Array<{ picnicProdukt: string }>
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
  ausVorrat: EinkaufsItem[]
}

interface EinkaufslisteSheetProps {
  daten: EinkaufslistenDaten
  onClose: () => void
}

function ItemListe({ items }: { items: EinkaufsItem[] }) {
  if (items.length === 0) return <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>—</p>
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm flex items-baseline gap-2" style={{ color: 'var(--near-black)' }}>
          <span style={{ color: 'var(--rausch)', flexShrink: 0 }}>·</span>
          <span className="flex-1">{item.name}</span>
          {item.menge > 0 && (
            <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>
              {item.menge} {item.einheit}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function PicnicListe({ items }: { items: Array<{ picnicProdukt: string }> }) {
  if (items.length === 0) return <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>—</p>
  // Deduplizieren: gleicher Produktname nur einmal anzeigen
  const unique = [...new Set(items.map(i => i.picnicProdukt))]
  return (
    <ul className="space-y-1">
      {unique.map((produkt, i) => (
        <li key={i} className="text-sm flex items-baseline gap-2" style={{ color: 'var(--near-black)' }}>
          <span style={{ color: '#5ba832', flexShrink: 0 }}>·</span>
          <span className="flex-1">{produkt}</span>
        </li>
      ))}
    </ul>
  )
}

export function EinkaufslisteSheet({ daten, onClose }: EinkaufslisteSheetProps) {
  const bring1 = aggregiere(daten.bring1)
  const bring2 = aggregiere(daten.bring2)
  const ausVorrat = aggregiere(daten.ausVorrat)
  const gesamtArtikel = daten.picnic.length + bring1.length + bring2.length
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => setVisible(true))
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleTouchStart(e: React.TouchEvent) { touchStartY.current = e.touches[0].clientY }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    if (e.touches[0].clientY - touchStartY.current > 80) { touchStartY.current = null; onClose() }
  }
  function handleTouchEnd() { touchStartY.current = null }

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="einkauf-title"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          background: '#ffffff',
          maxHeight: '80vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <div
          className="flex justify-center pt-3 pb-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(80vh - 40px)' }}>
          {/* Header */}
          <div className="flex items-baseline gap-2 mt-2 mb-5">
            <h2
              id="einkauf-title"
              className="text-lg font-bold"
              style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}
            >
              Einkaufsliste
            </h2>
            {gesamtArtikel > 0 && (
              <span className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
                · {gesamtArtikel} Artikel
              </span>
            )}
          </div>

          {/* Wochenplan-Button */}
          <button
            onClick={() => { onClose(); router.push('/wochenplan/uebersicht') }}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity mb-4"
            style={{ background: 'var(--surface)', color: 'var(--near-black)', minHeight: '48px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Wochenplan ansehen
          </button>

          {/* Picnic Block */}
          {daten.picnic.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#f0fae8' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#5ba832', color: '#ffffff', fontSize: '10px' }}
                >
                  Picnic
                </span>
                <span className="text-xs font-semibold" style={{ color: '#5ba832' }}>
                  {daten.picnic.length} Artikel
                </span>
              </div>
              <PicnicListe items={daten.picnic} />
            </div>
          )}

          {/* Bring Einkauf 1 Block */}
          {bring1.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}
                >
                  Bring · Einkauf 1
                </span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>
                  {bring1.length} Artikel
                </span>
              </div>
              <ItemListe items={bring1} />
            </div>
          )}

          {/* Bring Einkauf 2 Block */}
          {bring2.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}
                >
                  Bring · Einkauf 2
                </span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>
                  {bring2.length} Artikel
                </span>
              </div>
              <ItemListe items={bring2} />
            </div>
          )}

          {/* Aus dem Vorrat Block */}
          {ausVorrat.length > 0 && (
            <div className="rounded-xl p-3 mb-5" style={{ background: '#f5f5f5' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#888888', color: '#ffffff', fontSize: '10px' }}
                >
                  Aus dem Vorrat
                </span>
                <span className="text-xs font-semibold" style={{ color: '#888888' }}>
                  {ausVorrat.length} Artikel
                </span>
              </div>
              <ItemListe items={ausVorrat} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 3: Alle Tests laufen lassen**

```bash
npx jest --no-coverage
```

Erwartet: Alle Tests PASS.

- [ ] **Step 4: Committen**

```bash
git add components/EinkaufslisteSheet.tsx
git commit -m "feat: EinkaufslisteSheet mit Picnic-Produktnamen und Aus-dem-Vorrat-Sektion"
```

---

## Task 8: Deploy

- [ ] **Step 1: Push + Coolify-Deployment starten**

```bash
git push origin master
```

```bash
curl -s -X POST "http://140.82.38.192:8000/api/v1/applications/shpiw0907aj8qielobtzhxt8/stop" \
  -H "Authorization: Bearer 1|ifb2KsFvEc2olgSEuYYhDHltgnXgEPsYZnJgVkYk02033322" \
  -H "Content-Type: application/json"
```

```bash
curl -s -X POST "http://140.82.38.192:8000/api/v1/applications/shpiw0907aj8qielobtzhxt8/start" \
  -H "Authorization: Bearer 1|ifb2KsFvEc2olgSEuYYhDHltgnXgEPsYZnJgVkYk02033322" \
  -H "Content-Type: application/json"
```

- [ ] **Step 2: Deployment verifizieren**

Warten bis App antwortet:

```bash
until curl -s "http://shpiw0907aj8qielobtzhxt8.140.82.38.192.sslip.io/api/wochenplan" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'aktiverPlan' in d else 1)" 2>/dev/null; do sleep 5; done && echo "App bereit"
```

Dann Endpoint testen:

```bash
curl -s -X POST "http://shpiw0907aj8qielobtzhxt8.140.82.38.192.sslip.io/api/einkaufsliste/senden" \
  -H "Content-Type: application/json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('picnic:', len(d['listen']['picnic']), '| bring1:', len(d['listen']['bring1']), '| ausVorrat:', len(d['listen']['ausVorrat']))"
```

Erwartet: `picnic: N | bring1: N | ausVorrat: 0` (beim ersten Mal noch kein Vorrat vorhanden).
