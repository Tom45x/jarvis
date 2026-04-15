# 10-Tages-View & Freitags-Planlogik — Design

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan.

**Goal:** Die App zeigt immer einen 10-Tages-View (Fr–So der alten Woche + Mo–So der neuen Woche). Der Wochenplan wird freitags für die nächste Woche erstellt. Carry-over-Tage (Fr/Sa/So der alten Woche) sind sichtbar aber read-only und fließen nicht in die Einkaufsliste ein.

**Architecture:** Zwei separate Wochenplan-Datensätze in der DB (je Mo–So), kombiniert im Frontend zu einem 10-Slot-View. Kein Schema-Change erforderlich.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (supabase-js 2.x), React

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `lib/datum-utils.ts` | **Neu** — reine Datum-Hilfsfunktionen ohne Server-Import (client + server verwendbar) |
| `lib/wochenplan.ts` | `ladeWochenAnsicht()` hinzufügen, `speichereWochenplan()` auf aktiven Montag umstellen, Hilfsfunktionen aus `datum-utils` importieren |
| `app/api/wochenplan/route.ts` | GET gibt `{ carryOverPlan, aktiverPlan }` zurück; PUT unverändert |
| `app/api/einkaufsliste/senden/route.ts` | Nur `aktiverPlan` für Einkaufsliste verwenden |
| `app/wochenplan/page.tsx` | State von einzelnem Plan auf `{ carryOverPlan, aktiverPlan }` umstellen |
| `components/WochenplanGrid.tsx` | 10-Slot-View, importiert aus `datum-utils`, carry-over read-only |
| `__tests__/lib/wochenplan.test.ts` | Tests für neue Hilfsfunktionen ergänzen |

> **Wichtig:** `lib/wochenplan.ts` importiert `supabase-server` und ist daher server-only. Client-Components wie `WochenplanGrid.tsx` dürfen nicht daraus importieren. Deshalb kommen alle reinen Datum-Funktionen in die neue `lib/datum-utils.ts` (kein supabase-Import).

---

## `lib/datum-utils.ts` (neu)

Reine Datum-Hilfsfunktionen ohne Server-Abhängigkeiten. Verwendbar von Client- und Server-Code.

```typescript
// Berechnet den Montag der Woche, die 'datum' enthält
export function getMontag(datum: Date = new Date()): Date {
  const d = new Date(datum)
  const tag = d.getDay() // 0=So, 1=Mo, ..., 6=Sa
  const diff = tag === 0 ? -6 : 1 - tag
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Berechnet den letzten Freitag relativ zu heute
// Wenn heute Freitag ist, wird heute zurückgegeben
export function getLetztenFreitag(datum: Date = new Date()): Date {
  const d = new Date(datum)
  d.setHours(0, 0, 0, 0)
  const tag = d.getDay() // 0=So, 1=Mo, ..., 5=Fr, 6=Sa
  const daysBack = (tag + 2) % 7  // Fr→0, Sa→1, So→2, Mo→3, Di→4, Mi→5, Do→6
  d.setDate(d.getDate() - daysBack)
  return d
}

// Berechnet den Montag der Woche NACH dem letzten Freitag
// = der Montag für den der aktive Plan gilt
export function getAktivenMontag(datum: Date = new Date()): Date {
  const letzterFreitag = getLetztenFreitag(datum)
  const montag = getMontag(letzterFreitag)
  const aktiverMontag = new Date(montag)
  aktiverMontag.setDate(montag.getDate() + 7)
  return aktiverMontag
}
```

**Verifikation der Datumslogik:**
- Heute Do 16.04.2026 → letzterFreitag = Fr 10.04.2026 → carryOverMontag = Mo 06.04.2026 → aktiverMontag = Mo 13.04.2026 ✓
- Heute Fr 17.04.2026 → letzterFreitag = Fr 17.04.2026 (heute) → carryOverMontag = Mo 13.04.2026 → aktiverMontag = Mo 20.04.2026 ✓
- Heute Sa 18.04.2026 → letzterFreitag = Fr 17.04.2026 → aktiverMontag = Mo 20.04.2026 ✓

---

## Datenschicht (`lib/wochenplan.ts`)

`getMontag` wird aus `datum-utils` importiert (und dort gelöscht), alle anderen Imports bleiben unverändert.

### `ladeWochenAnsicht()` (ersetzt `ladeAktuellenWochenplan`)

```typescript
export interface WochenAnsicht {
  carryOverPlan: Wochenplan | null
  aktiverPlan: Wochenplan | null
}

export async function ladeWochenAnsicht(): Promise<WochenAnsicht> {
  const letzterFreitag = getLetztenFreitag()
  const carryOverMontag = getMontag(letzterFreitag).toISOString().split('T')[0]
  const aktiverMontag = getAktivenMontag().toISOString().split('T')[0]

  const [carryOverResult, aktivResult] = await Promise.all([
    supabase.from('wochenplaene').select('*').eq('woche_start', carryOverMontag).single(),
    supabase.from('wochenplaene').select('*').eq('woche_start', aktiverMontag).single(),
  ])

  return {
    carryOverPlan: carryOverResult.error ? null : (carryOverResult.data as Wochenplan),
    aktiverPlan: aktivResult.error ? null : (aktivResult.data as Wochenplan),
  }
}
```

### `speichereWochenplan()` — Ziel auf aktiven Montag umstellen

```typescript
export async function speichereWochenplan(
  eintraege: WochenplanEintrag[],
  status: 'entwurf' | 'genehmigt' = 'entwurf'
): Promise<Wochenplan> {
  const montag = getAktivenMontag().toISOString().split('T')[0]  // war: getMontag()
  const { data, error } = await supabase
    .from('wochenplaene')
    .upsert({ woche_start: montag, eintraege, status }, { onConflict: 'woche_start' })
    .select()
    .single()
  if (error) throw error
  return data as Wochenplan
}
```

`getMontag()` bleibt unverändert erhalten (wird intern weiter gebraucht).

---

## API (`app/api/wochenplan/route.ts`)

### GET

```typescript
export async function GET() {
  const ansicht = await ladeWochenAnsicht()
  return NextResponse.json(ansicht)
}
```

Gibt immer `{ carryOverPlan: Wochenplan | null, aktiverPlan: Wochenplan | null }` zurück.

### PUT

Unverändert — `speichereWochenplan()` schreibt nun automatisch in `getAktivenMontag()`.

---

## Einkaufsliste (`app/api/einkaufsliste/senden/route.ts`)

```typescript
// Vorher:
const plan = await ladeAktuellenWochenplan()
if (!plan) return NextResponse.json({ error: 'Kein Wochenplan ...' }, { status: 404 })

// Nachher:
const { aktiverPlan } = await ladeWochenAnsicht()
if (!aktiverPlan) return NextResponse.json({ error: 'Kein aktiver Wochenplan gefunden' }, { status: 404 })

// Überall wo plan.eintraege stand → aktiverPlan.eintraege
```

Carry-over-Einträge gehen nie in die Einkaufsliste ein, da nur `aktiverPlan.eintraege` übergeben wird.

---

## Seite (`app/wochenplan/page.tsx`)

### State-Änderung

```typescript
// Vorher:
const [plan, setPlan] = useState<Wochenplan | null>(null)

// Nachher:
const [carryOverPlan, setCarryOverPlan] = useState<Wochenplan | null>(null)
const [aktiverPlan, setAktiverPlan] = useState<Wochenplan | null>(null)
```

### Laden

```typescript
apiFetch('/api/wochenplan')
  .then(r => r.ok ? r.json() : null)
  .then((data: { carryOverPlan: Wochenplan | null, aktiverPlan: Wochenplan | null } | null) => {
    if (data) {
      setCarryOverPlan(data.carryOverPlan)
      setAktiverPlan(data.aktiverPlan)
    }
  })
```

### Mutationen (tauschen, waehlen, genehmigen)

Alle Mutationen operieren auf `aktiverPlan`. `setPlan(await res.json())` wird zu `setAktiverPlan(await res.json())`.

### WochenplanGrid Props

```typescript
<WochenplanGrid
  carryOverPlan={carryOverPlan}
  aktiverPlan={aktiverPlan}
  ...
/>
```

### Status-Anzeige und Buttons

- Statuszeile: `aktiverPlan?.status`
- "Plan genehmigen", Einkaufsliste senden: nur aktiv wenn `aktiverPlan` vorhanden
- "Neuer Plan erstellen" Button: immer sichtbar (generiert immer für `getAktivenMontag()`)
- Leerer Zustand: wenn weder `carryOverPlan` noch `aktiverPlan` vorhanden

---

## Grid (`components/WochenplanGrid.tsx`)

### Props

```typescript
interface WochenplanGridProps {
  carryOverPlan: Wochenplan | null
  aktiverPlan: Wochenplan | null
  // onTauschen, onWaehlen, onGenehmigen, onRezept bleiben unverändert
}
```

### 10-Slot-Struktur

`WochenplanGrid.tsx` importiert `getLetztenFreitag` und `getMontag` aus `@/lib/datum-utils` (nicht aus `wochenplan.ts`).

```typescript
// TagSlot-Typ (lokal in WochenplanGrid.tsx definiert)
interface TagSlot {
  tag: string
  datum: Date
  istCarryOver: boolean
}

// Berechnet die 10 Slot-Definitionen mit echten Kalenderdaten
function berechneSlots(): TagSlot[] {
  const tagVonJS = (d: Date) => ['sonntag','montag','dienstag','mittwoch','donnerstag','freitag','samstag'][d.getDay()]

  const letzterFreitag = getLetztenFreitag()
  const carryOverMontag = getMontag(letzterFreitag)

  const slots: TagSlot[] = []

  // Carry-over: Fr, Sa, So der alten Woche
  for (const offset of [4, 5, 6]) {
    const datum = new Date(carryOverMontag)
    datum.setDate(carryOverMontag.getDate() + offset)
    slots.push({ tag: tagVonJS(datum), datum, istCarryOver: true })
  }

  // Aktiv: Mo bis So der neuen Woche
  const aktiverMontag = new Date(carryOverMontag)
  aktiverMontag.setDate(carryOverMontag.getDate() + 7)
  for (let offset = 0; offset < 7; offset++) {
    const datum = new Date(aktiverMontag)
    datum.setDate(aktiverMontag.getDate() + offset)
    slots.push({ tag: tagVonJS(datum), datum, istCarryOver: false })
  }

  return slots
}
```

### "Heute"-Highlighting

```typescript
const istHeute = (datum: Date): boolean =>
  datum.toDateString() === new Date().toDateString()
```

### Carry-over Slots — Read-only

Carry-over-Slots rendern nur die Gericht-Karte (kein Tauschen, kein Wählen), mit gedämpftem Tag-Header:

```tsx
// Tag-Header für carry-over: grauer Kreis statt roter Kreis für heute
<div style={{
  background: istHeute(slot.datum) ? 'var(--rausch)' : slot.istCarryOver ? 'transparent' : 'var(--surface)',
  border: slot.istCarryOver && !istHeute(slot.datum) ? '1px solid var(--border)' : 'none',
  color: istHeute(slot.datum) ? '#ffffff' : 'var(--near-black)',
  opacity: slot.istCarryOver ? 0.6 : 1,
}}>
  {TAG_SHORT[slot.tag]}
</div>
```

Für carry-over-Slots: `StaticCard` statt `GerichtCard` (keine Buttons), aber mit dem echten Gericht-Namen aus `carryOverPlan.eintraege`.

---

## Tests

### `__tests__/lib/wochenplan.test.ts`

`getMontag`-Tests bleiben hier, Import-Pfad auf `@/lib/datum-utils` ändern.

### `__tests__/lib/datum-utils.test.ts` (neu)

```typescript
import { getLetztenFreitag, getAktivenMontag, getMontag } from '@/lib/datum-utils'

describe('getLetztenFreitag', () => {
  it('gibt heute zurück wenn heute Freitag', () => {
    const freitag = new Date('2026-04-17T10:00:00')
    expect(getLetztenFreitag(freitag).getDate()).toBe(17)
  })
  it('gibt letzten Freitag zurück wenn heute Donnerstag', () => {
    const donnerstag = new Date('2026-04-16T10:00:00')
    expect(getLetztenFreitag(donnerstag).getDate()).toBe(10)
  })
  it('gibt letzten Freitag zurück wenn heute Samstag', () => {
    const samstag = new Date('2026-04-18T10:00:00')
    expect(getLetztenFreitag(samstag).getDate()).toBe(17)
  })
})

describe('getAktivenMontag', () => {
  it('gibt nächsten Montag zurück wenn heute Freitag', () => {
    const freitag = new Date('2026-04-17T10:00:00')
    expect(getAktivenMontag(freitag).getDate()).toBe(20) // Mo 20.04.
  })
  it('gibt den Montag der aktuellen Woche zurück wenn heute Donnerstag', () => {
    const donnerstag = new Date('2026-04-16T10:00:00')
    expect(getAktivenMontag(donnerstag).getDate()).toBe(13) // Mo 13.04.
  })
})
```

---

## Randfälle

| Situation | Verhalten |
|---|---|
| Kein carryOverPlan in DB | Carry-over-Slots zeigen leere `StaticCard` mit „—" |
| Kein aktiverPlan in DB | Aktive Slots zeigen leere `StaticCard` mit „—"; Buttons „Plan erstellen" sichtbar |
| Heute ist Fr und Plan für nächste Woche existiert noch nicht | Carry-over = diese Woche (Fr–So), aktiv = leer → Plan-erstellen-Button generiert für nächste Woche |
| Genehmigen-Button | Nur sichtbar wenn `aktiverPlan?.status === 'entwurf'` |
