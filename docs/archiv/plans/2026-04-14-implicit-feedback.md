# Implizites Feedback-System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerichte die oft weggetauscht werden automatisch sperren und auf der Gerichte-Seite zur manuellen Entscheidung (Löschen oder Reaktivieren) anbieten.

**Architecture:** Zwei neue Spalten in `gerichte` (`tausch_count`, `gesperrt`). Bei jedem Tausch im Wochenplan wird `tausch_count` hochgezählt — ab 4 wird `gesperrt=true`. Claude bekommt nur nicht-gesperrte Gerichte. Die Gerichte-Seite zeigt gesperrte Gerichte in einem separaten Bereich.

**Tech Stack:** Next.js App Router, TypeScript, Supabase

---

## Dateistruktur

```
Neu:
  supabase/migration_feedback.sql
  app/api/gerichte/[id]/tauschen/route.ts     PATCH: count hochzählen, ggf. sperren
  app/api/gerichte/[id]/reaktivieren/route.ts  PATCH: count + gesperrt zurücksetzen

Geändert:
  types/index.ts                               Gericht: + tausch_count?, gesperrt?
  app/api/gerichte/[id]/route.ts               + DELETE Handler
  app/api/wochenplan/generate/route.ts         gesperrt=false Filter
  app/wochenplan/page.tsx                      tauschen() ruft API auf + filtert gesperrt
  app/gerichte/page.tsx                        + Gesperrt-Sektion
```

---

### Task 1: DB-Migration + Types

**Files:**
- Create: `supabase/migration_feedback.sql`
- Modify: `types/index.ts`

- [ ] **Step 1: Migration-Datei anlegen**

Erstelle `supabase/migration_feedback.sql`:

```sql
ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS tausch_count INT DEFAULT 0;
ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS gesperrt BOOLEAN DEFAULT FALSE;

-- Sicherheitsnetz für bestehende Zeilen
UPDATE gerichte SET tausch_count = 0 WHERE tausch_count IS NULL;
UPDATE gerichte SET gesperrt = false WHERE gesperrt IS NULL;
```

- [ ] **Step 2: Migration im Supabase Dashboard ausführen**

1. Supabase Dashboard → SQL Editor
2. Inhalt von `migration_feedback.sql` einfügen → Run
3. Prüfen: "Success. No rows returned"

- [ ] **Step 3: Gericht-Type erweitern**

In `types/index.ts` das `Gericht`-Interface um zwei optionale Felder ergänzen:

```typescript
export interface Gericht {
  id: string
  name: string
  zutaten: Zutat[]
  gesund: boolean
  kategorie: Kategorie
  beliebtheit: Record<string, number>
  quelle: 'manuell' | 'themealdb'
  tausch_count?: number   // neu
  gesperrt?: boolean      // neu
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migration_feedback.sql types/index.ts
git commit -m "feat: add tausch_count and gesperrt fields to gerichte"
```

---

### Task 2: API Route — tauschen

**Files:**
- Create: `app/api/gerichte/[id]/tauschen/route.ts`

- [ ] **Step 1: Route anlegen**

Erstelle `app/api/gerichte/[id]/tauschen/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const SPERR_SCHWELLE = 4

export function berechneGesperrt(neuerCount: number): boolean {
  return neuerCount >= SPERR_SCHWELLE
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: gericht, error: fetchError } = await supabase
    .from('gerichte')
    .select('tausch_count')
    .eq('id', id)
    .single()

  if (fetchError || !gericht) {
    return NextResponse.json({ error: 'Gericht nicht gefunden' }, { status: 404 })
  }

  const neuerCount = ((gericht as { tausch_count: number }).tausch_count ?? 0) + 1
  const gesperrt = berechneGesperrt(neuerCount)

  const { data, error } = await supabase
    .from('gerichte')
    .update({ tausch_count: neuerCount, gesperrt })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/gerichte/[id]/tauschen/route.ts
git commit -m "feat: add tauschen API route with auto-gesperrt at 4 swaps"
```

---

### Task 3: API Route — reaktivieren + DELETE

**Files:**
- Create: `app/api/gerichte/[id]/reaktivieren/route.ts`
- Modify: `app/api/gerichte/[id]/route.ts`

- [ ] **Step 1: Reaktivieren-Route anlegen**

Erstelle `app/api/gerichte/[id]/reaktivieren/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('gerichte')
    .update({ tausch_count: 0, gesperrt: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: DELETE zu bestehender Route hinzufügen**

In `app/api/gerichte/[id]/route.ts` den DELETE-Handler ergänzen (bestehenden PATCH-Handler behalten):

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await supabase.from('gerichte').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/gerichte/[id]/reaktivieren/route.ts app/api/gerichte/[id]/route.ts
git commit -m "feat: add reaktivieren route and DELETE handler for gerichte"
```

---

### Task 4: Claude-Filter — gesperrt=false

**Files:**
- Modify: `app/api/wochenplan/generate/route.ts`

- [ ] **Step 1: Gesperrte Gerichte aus Claude-Abfrage ausschließen**

In `app/api/wochenplan/generate/route.ts` die Gerichte-Abfrage anpassen:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generiereWochenplan } from '@/lib/claude'
import { erstelleWochenplanEintraege, speichereWochenplan } from '@/lib/wochenplan'
import type { FamilieMitglied, Gericht } from '@/types'

export async function POST() {
  const [{ data: profile }, { data: gerichte }] = await Promise.all([
    supabase.from('familie_profile').select('*'),
    supabase.from('gerichte').select('*').eq('gesperrt', false),  // geändert
  ])

  if (!profile || !gerichte) {
    return NextResponse.json({ error: 'Daten konnten nicht geladen werden' }, { status: 500 })
  }

  const ergebnis = await generiereWochenplan(
    profile as FamilieMitglied[],
    gerichte as Gericht[]
  )

  const eintraege = erstelleWochenplanEintraege(ergebnis.mahlzeiten, gerichte as Gericht[])
  const plan = await speichereWochenplan(eintraege, 'entwurf')

  return NextResponse.json({ ...plan, drinks: ergebnis.drinks })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/wochenplan/generate/route.ts
git commit -m "feat: exclude gesperrt gerichte from wochenplan generation"
```

---

### Task 5: Wochenplan-Seite — tauschen erweitern

**Files:**
- Modify: `app/wochenplan/page.tsx`

- [ ] **Step 1: tauschen()-Funktion erweitern**

In `app/wochenplan/page.tsx` die `tauschen()`-Funktion ersetzen:

```typescript
async function tauschen(tag: string, mahlzeit: string) {
  if (!plan) return
  const aktuell = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit)
  // Gesperrte Gerichte aus der Zufallsauswahl ausschließen
  const andere = gerichte.filter(g => g.id !== aktuell?.gericht_id && !g.gesperrt)
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

  // Fire-and-forget: Tausch im alten Gericht protokollieren
  if (aktuell?.gericht_id) {
    fetch(`/api/gerichte/${aktuell.gericht_id}/tauschen`, { method: 'PATCH' }).catch(() => {})
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/wochenplan/page.tsx
git commit -m "feat: log swaps via tauschen API and exclude gesperrt gerichte"
```

---

### Task 6: Gerichte-Seite — Gesperrt-Sektion

**Files:**
- Modify: `app/gerichte/page.tsx`

- [ ] **Step 1: State und Handler für gesperrte Gerichte ergänzen**

In `app/gerichte/page.tsx` nach den bestehenden State-Definitionen hinzufügen:

```typescript
const [loescht, setLoescht] = useState<string | null>(null)
```

Und folgende Handler-Funktionen hinzufügen (nach der `speichern()`-Funktion):

```typescript
async function reaktivieren(id: string) {
  await fetch(`/api/gerichte/${id}/reaktivieren`, { method: 'PATCH' })
  const updated = await fetch('/api/gerichte').then(r => r.json())
  setGerichte(updated)
  setMeldung('✅ Gericht reaktiviert')
}

async function loeschen(id: string) {
  setLoescht(id)
  try {
    await fetch(`/api/gerichte/${id}`, { method: 'DELETE' })
    const updated = await fetch('/api/gerichte').then(r => r.json())
    setGerichte(updated)
    setMeldung('✅ Gericht gelöscht')
  } finally {
    setLoescht(null)
  }
}
```

- [ ] **Step 2: Gerichte in aktiv und gesperrt aufteilen**

Die bestehende Zeile:
```typescript
const ohneZutaten = gerichte.filter(g => g.zutaten.length === 0).length
```

Ersetzen durch:
```typescript
const aktiveGerichte = gerichte.filter(g => !g.gesperrt)
const gesperrteGerichte = gerichte.filter(g => g.gesperrt)
const ohneZutaten = aktiveGerichte.filter(g => g.zutaten.length === 0).length
```

- [ ] **Step 3: Bestehende Gerichte-Liste auf aktiveGerichte umstellen**

```typescript
// alt:
{gerichte.map(gericht => (
// neu:
{aktiveGerichte.map(gericht => (
```

- [ ] **Step 4: Gesperrt-Sektion ans Ende des Returns anhängen**

Nach der bestehenden `<div className="space-y-3">` Liste, vor dem schließenden `</main>` einfügen:

```tsx
{gesperrteGerichte.length > 0 && (
  <div className="mt-10">
    <h2 className="text-lg font-semibold text-gray-700 mb-3">
      Gesperrt ({gesperrteGerichte.length})
    </h2>
    <p className="text-sm text-gray-500 mb-4">
      Diese Gerichte wurden zu oft getauscht und werden nicht mehr vorgeschlagen.
    </p>
    <div className="space-y-2">
      {gesperrteGerichte.map(gericht => (
        <div
          key={gericht.id}
          className="border border-red-200 bg-red-50 rounded-lg p-4 flex justify-between items-center"
        >
          <div>
            <p className="font-medium text-gray-800">{gericht.name}</p>
            <p className="text-xs text-red-500 mt-1">
              {gericht.tausch_count}x getauscht
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => reaktivieren(gericht.id)}
              className="text-sm text-green-600 hover:text-green-800 border border-green-300 rounded px-3 py-1"
            >
              Reaktivieren
            </button>
            <button
              onClick={() => loeschen(gericht.id)}
              disabled={loescht === gericht.id}
              className="text-sm text-red-600 hover:text-red-800 border border-red-300 rounded px-3 py-1 disabled:opacity-50"
            >
              {loescht === gericht.id ? 'Löscht...' : 'Löschen'}
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add app/gerichte/page.tsx
git commit -m "feat: add gesperrt section to gerichte page with reaktivieren and loeschen"
```
