# Rezepte-Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jedes Gericht bekommt ein Rezept (Zutaten-Strings + Zubereitungsschritte), das Claude automatisch generiert, auf der Gerichte-Seite bearbeitbar ist und im Wochenplan über ein Bottom Sheet abrufbar ist.

**Architecture:** Neues `rezept`-Feld in `Gericht` (JSONB in DB). Neuer API-Endpoint `/api/rezepte/generieren` generiert Rezepte via Claude. Neue `RezeptSheet`-Komponente rendert ein Bottom Sheet im Wochenplan. Auf der Gerichte-Seite werden Schritte inline bearbeitet.

**Tech Stack:** Next.js 15, TypeScript, Supabase (JSONB), Anthropic Claude API, Tailwind CSS, React useState/useEffect

---

## Voraussetzung: DB-Migration

Muss einmalig manuell im Supabase-Dashboard (SQL-Editor) ausgeführt werden, BEVOR die App startet:

```sql
ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS rezept JSONB DEFAULT NULL;
```

---

## File Map

| Datei | Aktion | Verantwortung |
|-------|--------|---------------|
| `app/types/index.ts` | Modify | `rezept`-Feld zu `Gericht` hinzufügen |
| `app/app/api/rezepte/generieren/route.ts` | Create | Claude-Endpoint für Rezept-Generierung |
| `app/components/RezeptSheet.tsx` | Create | Bottom Sheet Komponente |
| `app/components/GerichtCard.tsx` | Modify | "Rezept →" Link hinzufügen |
| `app/app/wochenplan/page.tsx` | Modify | rezeptGericht-State, RezeptSheet einbinden |
| `app/components/WochenplanGrid.tsx` | Modify | `onRezept`-Callback durchreichen |
| `app/app/gerichte/page.tsx` | Modify | Zubereitung anzeigen/bearbeiten |

---

## Task 1: Typ-Erweiterung

**Files:**
- Modify: `app/types/index.ts`

- [ ] **Schritt 1: `rezept`-Feld zu `Gericht` hinzufügen**

In `app/types/index.ts` das Interface `Gericht` erweitern:

```typescript
export interface Gericht {
  id: string
  name: string
  zutaten: Zutat[]
  gesund: boolean
  kategorie: Kategorie
  beliebtheit: Record<string, number>
  quelle: 'manuell' | 'themealdb' | 'ki-vorschlag'
  aufwand?: string
  tausch_count?: number
  gesperrt?: boolean
  bewertung?: number
  rezept?: {
    zutaten: string[]       // lesbare Strings: "200g Nudeln", "2 Eier"
    zubereitung: string[]   // ["Wasser zum Kochen bringen", "Nudeln al dente garen"]
  }
}
```

- [ ] **Schritt 2: TypeScript-Fehler prüfen**

```bash
cd app && npx tsc --noEmit
```

Erwartet: Keine neuen Fehler (das Feld ist optional).

- [ ] **Schritt 3: Committen**

```bash
git add app/types/index.ts
git commit -m "feat: Gericht-Typ um optionales rezept-Feld erweitern"
```

---

## Task 2: API-Endpoint `/api/rezepte/generieren`

**Files:**
- Create: `app/app/api/rezepte/generieren/route.ts`

- [ ] **Schritt 1: Route-Datei erstellen**

Verzeichnis anlegen und Datei erstellen:

```typescript
// app/app/api/rezepte/generieren/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'
import type { Gericht } from '@/types'

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'KI nicht konfiguriert' }, { status: 503 })
  }

  const body = await request.json().catch(() => ({}))
  const { gerichtId } = body as { gerichtId?: string }

  // Gerichte laden — mit ID: nur dieses; ohne ID: alle ohne Rezept
  let query = supabase.from('gerichte').select('id, name')
  if (gerichtId) {
    query = query.eq('id', gerichtId)
  } else {
    query = query.is('rezept', null)
  }

  const { data: gerichte, error } = await query.order('name')
  if (error || !gerichte || gerichte.length === 0) {
    return NextResponse.json({ aktualisiert: 0 })
  }

  const gerichtListe = (gerichte as Pick<Gericht, 'id' | 'name'>[])
    .map(g => `- ${g.name}`)
    .join('\n')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `Erstelle für jedes der folgenden Gerichte ein vollständiges Rezept für 4 Personen (2 Erwachsene, 2 Kinder 8–11 Jahre).

Für jedes Gericht:
- zutaten: 4–8 lesbare Zutat-Strings (z.B. "200g Spaghetti", "2 Knoblauchzehen", "1 Dose Tomaten")
- zubereitung: 4–6 klare Zubereitungsschritte auf Deutsch

Gerichte:
${gerichtListe}

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "gerichte": [
    {
      "name": "...",
      "rezept": {
        "zutaten": ["...", "..."],
        "zubereitung": ["Schritt 1: ...", "Schritt 2: ..."]
      }
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

  let parsed: { gerichte: Array<{ name: string; rezept: { zutaten: string[]; zubereitung: string[] } }> }
  try {
    parsed = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: `Ungültige JSON-Antwort von Claude: ${text.slice(0, 200)}` }, { status: 502 })
  }

  const updates = parsed.gerichte.map(async (g) => {
    const gericht = (gerichte as Pick<Gericht, 'id' | 'name'>[]).find(dbG => dbG.name === g.name)
    if (!gericht) return
    return supabase
      .from('gerichte')
      .update({ rezept: g.rezept })
      .eq('id', gericht.id)
  })

  await Promise.all(updates)

  return NextResponse.json({ aktualisiert: parsed.gerichte.length })
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Schritt 3: Committen**

```bash
git add app/app/api/rezepte/generieren/route.ts
git commit -m "feat: API-Endpoint POST /api/rezepte/generieren"
```

---

## Task 3: RezeptSheet-Komponente

**Files:**
- Create: `app/components/RezeptSheet.tsx`

- [ ] **Schritt 1: Komponente erstellen**

```typescript
// app/components/RezeptSheet.tsx
'use client'

import { useEffect } from 'react'
import type { Gericht } from '@/types'

interface RezeptSheetProps {
  gericht: Gericht
  onClose: () => void
}

export function RezeptSheet({ gericht, onClose }: RezeptSheetProps) {
  // Body-Scroll sperren solange Sheet offen ist
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!gericht.rezept) return null

  return (
    <>
      {/* Hintergrund-Overlay */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Sheet-Panel */}
      <div
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          background: '#ffffff',
          maxHeight: '80vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        }}
      >
        {/* Drag-Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Scrollbarer Inhalt */}
        <div className="overflow-y-auto px-5 pb-10" style={{ maxHeight: 'calc(80vh - 40px)' }}>
          {/* Titel */}
          <h2 className="text-lg font-bold mt-2 mb-5" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
            {gericht.name}
          </h2>

          {/* Zutaten */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--near-black)' }}>
              Zutaten (4 Personen)
            </h3>
            <ul className="space-y-1.5">
              {gericht.rezept.zutaten.map((z, i) => (
                <li key={`zutat-${i}`} className="flex items-start gap-2 text-sm" style={{ color: 'var(--near-black)' }}>
                  <span style={{ color: 'var(--rausch)', flexShrink: 0 }}>·</span>
                  {z}
                </li>
              ))}
            </ul>
          </div>

          {/* Zubereitung */}
          <div>
            <h3 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--near-black)' }}>
              Zubereitung
            </h3>
            <ol className="space-y-3">
              {gericht.rezept.zubereitung.map((schritt, i) => (
                <li key={`schritt-${i}`} className="flex items-start gap-3">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--rausch)', color: '#ffffff' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed pt-0.5" style={{ color: 'var(--near-black)' }}>
                    {schritt.replace(/^Schritt \d+:\s*/i, '')}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Schritt 3: Committen**

```bash
git add app/components/RezeptSheet.tsx
git commit -m "feat: RezeptSheet Bottom-Sheet-Komponente"
```

---

## Task 4: GerichtCard — Rezept-Link

**Files:**
- Modify: `app/components/GerichtCard.tsx`

- [ ] **Schritt 1: Props erweitern und Rezept-Link hinzufügen**

Die gesamte Datei `app/components/GerichtCard.tsx` ersetzen:

```typescript
'use client'

import type { Mahlzeit } from '@/types'

const MAHLZEIT_CONFIG: Record<Mahlzeit, { label: string }> = {
  'frühstück': { label: 'Frühstück' },
  'mittag': { label: 'Mittag' },
  'abend': { label: 'Abend' },
}

interface GerichtCardProps {
  gerichtName: string
  mahlzeit: Mahlzeit
  gesund?: boolean
  hatRezept?: boolean
  onTauschen?: () => void
  onRezept?: () => void
}

export function GerichtCard({ gerichtName, mahlzeit, gesund, hatRezept, onTauschen, onRezept }: GerichtCardProps) {
  const { label } = MAHLZEIT_CONFIG[mahlzeit]

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>
            {label}
          </p>
          <p className="font-semibold text-sm leading-snug truncate" style={{ color: 'var(--near-black)' }}>
            {gerichtName}
          </p>
          {gesund && (
            <span className="text-xs mt-1 inline-block" style={{ color: '#3d9970' }}>
              ✓ gesund
            </span>
          )}
        </div>
        {onTauschen && (
          <button
            onClick={onTauschen}
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)' }}
            aria-label={`${gerichtName} tauschen`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--near-black)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        )}
      </div>

      {/* Rezept-Link — nur wenn Rezept vorhanden */}
      {hatRezept && onRezept && (
        <button
          onClick={onRezept}
          className="mt-2 pt-2 w-full text-left text-xs font-medium active:opacity-70 transition-opacity"
          style={{
            borderTop: '1px solid var(--surface)',
            color: 'var(--rausch)',
          }}
        >
          Rezept ansehen →
        </button>
      )}
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Schritt 3: Committen**

```bash
git add app/components/GerichtCard.tsx
git commit -m "feat: GerichtCard — Rezept-Link hinzufügen"
```

---

## Task 5: WochenplanGrid — onRezept-Callback

**Files:**
- Modify: `app/components/WochenplanGrid.tsx`

- [ ] **Schritt 1: Props und Callbacks erweitern**

`app/components/WochenplanGrid.tsx` vollständig ersetzen:

```typescript
'use client'

import { useEffect, useMemo, useRef } from 'react'
import { GerichtCard } from '@/components/GerichtCard'
import type { Wochenplan, Gericht } from '@/types'

const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const
const TAG_LABEL: Record<string, string> = {
  montag: 'Montag', dienstag: 'Dienstag', mittwoch: 'Mittwoch',
  donnerstag: 'Donnerstag', freitag: 'Freitag', samstag: 'Samstag', sonntag: 'Sonntag'
}
const TAG_SHORT: Record<string, string> = {
  montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi',
  donnerstag: 'Do', freitag: 'Fr', samstag: 'Sa', sonntag: 'So'
}
const WOCHENENDE = new Set(['samstag', 'sonntag'])

function heutigerTag(): string {
  const tage = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
  return tage[new Date().getDay()]
}

function heutigesDatum(): string {
  return new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

interface WochenplanGridProps {
  plan: Wochenplan
  gerichte: Gericht[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onGenehmigen: () => void
  onRezept: (gericht: Gericht) => void
}

export function WochenplanGrid({ plan, gerichte, onTauschen, onGenehmigen, onRezept }: WochenplanGridProps) {
  const gerichtMap = useMemo(
    () => Object.fromEntries(gerichte.map(g => [g.id, g])),
    [gerichte]
  )
  const heute = heutigerTag()
  const scrollRef = useRef<HTMLDivElement>(null)
  const heuteRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const autoScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const doScroll = () => {
      if (!heuteRef.current || !scrollRef.current) return
      const container = scrollRef.current
      const card = heuteRef.current
      container.scrollTo({
        left: card.offsetLeft - (container.offsetWidth - card.offsetWidth) / 2,
        behavior: 'smooth',
      })
    }

    if (isFirstRender.current) {
      isFirstRender.current = false
      doScroll()
      return
    }

    if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current)
    autoScrollTimer.current = setTimeout(doScroll, 3000)
    return () => {
      if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current)
    }
  }, [plan])

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-hide pb-2"
        style={{
          paddingLeft: '16px',
          paddingRight: '16px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
        }}
      >
        {TAGE.map(tag => {
          const fruehstueck = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'frühstück')
          const mittag = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'mittag')
          const abend = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'abend')
          const istWochenende = WOCHENENDE.has(tag)
          const istHeute = tag === heute

          return (
            <div
              key={tag}
              ref={istHeute ? heuteRef : null}
              className="shrink-0 flex flex-col gap-2"
              style={{
                width: 'calc(85vw - 32px)',
                maxWidth: '320px',
                scrollSnapAlign: 'start',
              }}
            >
              <div className="flex items-center gap-2 px-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: istHeute ? 'var(--rausch)' : 'var(--surface)',
                    color: istHeute ? '#ffffff' : 'var(--near-black)',
                  }}
                >
                  {TAG_SHORT[tag]}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--near-black)' }}>
                    {TAG_LABEL[tag]}
                  </p>
                  {istHeute && (
                    <p className="text-xs leading-tight" style={{ color: 'var(--rausch)' }}>
                      {heutigesDatum()}
                    </p>
                  )}
                </div>
              </div>

              {/* Frühstück */}
              {istWochenende && fruehstueck ? (
                <GerichtCard
                  gerichtName={fruehstueck.gericht_name}
                  mahlzeit="frühstück"
                  gesund={gerichtMap[fruehstueck.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[fruehstueck.gericht_id]?.rezept}
                  onTauschen={() => onTauschen(tag, 'frühstück')}
                  onRezept={() => { const g = gerichtMap[fruehstueck.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>Frühstück</p>
                  <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>Toast mit Aufschnitt</p>
                </div>
              )}

              {/* Mittag */}
              {mittag ? (
                <GerichtCard
                  gerichtName={mittag.gericht_name}
                  mahlzeit="mittag"
                  gesund={gerichtMap[mittag.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[mittag.gericht_id]?.rezept}
                  onTauschen={() => onTauschen(tag, 'mittag')}
                  onRezept={() => { const g = gerichtMap[mittag.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>Mittag</p>
                  <p className="text-sm" style={{ color: 'var(--gray-disabled)' }}>—</p>
                </div>
              )}

              {/* Abend */}
              {abend ? (
                <GerichtCard
                  gerichtName={abend.gericht_name}
                  mahlzeit="abend"
                  gesund={gerichtMap[abend.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[abend.gericht_id]?.rezept}
                  onTauschen={() => onTauschen(tag, 'abend')}
                  onRezept={() => { const g = gerichtMap[abend.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>Abend</p>
                  <p className="text-sm" style={{ color: 'var(--gray-disabled)' }}>—</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {plan.status === 'entwurf' && (
        <div className="px-4">
          <button
            onClick={onGenehmigen}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity active:opacity-70"
            style={{ background: 'var(--near-black)', color: '#ffffff', minHeight: '52px' }}
          >
            Plan genehmigen ✓
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Schritt 3: Committen**

```bash
git add app/components/WochenplanGrid.tsx
git commit -m "feat: WochenplanGrid — onRezept-Callback und hatRezept-Prop"
```

---

## Task 6: Wochenplan-Page — RezeptSheet einbinden

**Files:**
- Modify: `app/app/wochenplan/page.tsx`

- [ ] **Schritt 1: RezeptSheet importieren und State hinzufügen**

Import-Zeilen am Anfang der Datei ergänzen:

```typescript
import { RezeptSheet } from '@/components/RezeptSheet'
import type { Wochenplan, Gericht, DrinkVorschlag } from '@/types'
```

(Hinweis: `Gericht` zum bestehenden `import type`-Statement hinzufügen)

- [ ] **Schritt 2: State hinzufügen**

Nach dem `einkaufMeldung`-State:

```typescript
const [rezeptGericht, setRezeptGericht] = useState<Gericht | null>(null)
```

- [ ] **Schritt 3: onRezept-Callback an WochenplanGrid übergeben**

Den `<WochenplanGrid>`-Aufruf anpassen:

```typescript
<WochenplanGrid
  plan={plan}
  gerichte={gerichte}
  onTauschen={tauschen}
  onGenehmigen={genehmigen}
  onRezept={setRezeptGericht}
/>
```

- [ ] **Schritt 4: RezeptSheet am Ende des `<main>`-Elements hinzufügen**

Direkt vor dem schließenden `</main>`-Tag:

```typescript
{rezeptGericht && (
  <RezeptSheet
    gericht={rezeptGericht}
    onClose={() => setRezeptGericht(null)}
  />
)}
```

- [ ] **Schritt 5: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Schritt 6: Committen**

```bash
git add app/app/wochenplan/page.tsx
git commit -m "feat: Wochenplan — RezeptSheet einbinden"
```

---

## Task 7: Gerichte-Seite — Rezept anzeigen und bearbeiten

**Files:**
- Modify: `app/app/gerichte/page.tsx`

- [ ] **Schritt 1: State für Rezept-Bearbeitung hinzufügen**

Nach dem bestehenden `bearbeiteZutaten`-State:

```typescript
const [bearbeiteRezept, setBearbeiteRezept] = useState<{
  zutaten: string[]
  zubereitung: string[]
} | null>(null)
```

- [ ] **Schritt 2: `bearbeiteStart`-Funktion erweitern**

Die bestehende Funktion:

```typescript
function bearbeiteStart(gericht: Gericht) {
  setBearbeiteId(gericht.id)
  setBearbeiteZutaten([...gericht.zutaten])
  setBearbeiteRezept(gericht.rezept
    ? { zutaten: [...gericht.rezept.zutaten], zubereitung: [...gericht.rezept.zubereitung] }
    : { zutaten: [], zubereitung: [] }
  )
}
```

- [ ] **Schritt 3: `speichern`-Funktion erweitern**

Den `fetch`-Body erweitern:

```typescript
body: JSON.stringify({ zutaten: bearbeiteZutaten, rezept: bearbeiteRezept })
```

- [ ] **Schritt 4: Rezept-Generierung per Einzelgericht**

Eine neue Funktion `einzelnRezeptGenerieren` hinzufügen (nach `einzelnGenerieren`):

```typescript
async function einzelnRezeptGenerieren(gericht: Gericht) {
  setMeldung(null)
  try {
    const res = await apiFetch('/api/rezepte/generieren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gerichtId: gericht.id })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Fehler')
    setMeldung(`✅ Rezept für ${gericht.name} generiert`)
    const updated = await apiFetch('/api/gerichte').then(r => r.json())
    setGerichte(updated)
  } catch (e: unknown) {
    setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
  }
}
```

- [ ] **Schritt 5: "✨ Alles generieren"-Button**

Den bestehenden "✨ Zutaten"-Button durch "✨ Alles generieren" ersetzen, der sowohl Zutaten als auch Rezepte generiert:

```typescript
// bestehende alleZutatenGenerieren-Funktion umbenennen/erweitern:
async function allesDatenGenerieren() {
  setGeneriere(true)
  setMeldung(null)
  try {
    // Zutaten generieren
    const res1 = await apiFetch('/api/zutaten/generieren', { method: 'POST' })
    const data1 = await res1.json()
    if (!res1.ok) throw new Error(data1.error ?? 'Fehler')

    // Rezepte generieren (nur für Gerichte ohne Rezept)
    const res2 = await apiFetch('/api/rezepte/generieren', { method: 'POST' })
    const data2 = await res2.json()
    if (!res2.ok) throw new Error(data2.error ?? 'Fehler')

    setMeldung(`✅ ${data1.aktualisiert} Zutaten, ${data2.aktualisiert} Rezepte aktualisiert`)
    const updated = await apiFetch('/api/gerichte').then(r => r.json())
    setGerichte(updated)
  } catch (e: unknown) {
    setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
  } finally {
    setGeneriere(false)
  }
}
```

Button-Label im JSX: `{generiere ? '...' : '✨ Generieren'}`

- [ ] **Schritt 6: Rezept-Anzeige im aufgeklappten Zustand (read-only)**

In der aufgeklappten Karte, nach der Zutaten-Vorschau und vor den Action-Buttons, folgendes ergänzen (innerhalb des `!isEditing`-Blocks):

```typescript
{/* Rezept-Vorschau (nur wenn vorhanden und nicht im Bearbeitungsmodus) */}
{!isEditing && gericht.rezept && (
  <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--surface)' }}>
    <p className="text-xs font-semibold" style={{ color: 'var(--near-black)' }}>Zubereitung</p>
    <ol className="space-y-1">
      {gericht.rezept.zubereitung.map((schritt, i) => (
        <li key={`schritt-${gericht.id}-${i}`} className="text-xs flex gap-2" style={{ color: 'var(--gray-secondary)' }}>
          <span className="shrink-0 font-semibold" style={{ color: 'var(--rausch)' }}>{i + 1}.</span>
          {schritt.replace(/^Schritt \d+:\s*/i, '')}
        </li>
      ))}
    </ol>
  </div>
)}
```

- [ ] **Schritt 7: Rezept bearbeiten im Bearbeitungsmodus**

Im `isEditing`-Block, nach der Zutaten-Bearbeitung, aber vor den Speichern/Abbrechen-Buttons:

```typescript
{/* Rezept bearbeiten */}
{bearbeiteRezept && (
  <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--surface)', paddingTop: '12px' }}>
    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--near-black)' }}>Zubereitung</p>
    {bearbeiteRezept.zubereitung.map((schritt, i) => (
      <div key={`edit-schritt-${i}`} className="flex gap-1.5 items-start">
        <span className="text-xs font-semibold pt-2 shrink-0" style={{ color: 'var(--rausch)' }}>{i + 1}.</span>
        <textarea
          value={schritt.replace(/^Schritt \d+:\s*/i, '')}
          onChange={e => {
            const neu = [...bearbeiteRezept.zubereitung]
            neu[i] = e.target.value
            setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: neu })
          }}
          rows={2}
          className="flex-1 px-2 py-1.5 rounded-lg resize-none"
          style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '14px' }}
        />
        <button
          onClick={() => {
            const neu = bearbeiteRezept.zubereitung.filter((_, idx) => idx !== i)
            setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: neu })
          }}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70"
          style={{ background: '#fff0f3', color: 'var(--rausch)' }}
        >
          ✕
        </button>
      </div>
    ))}
    <div className="flex gap-2 pt-1">
      <button
        onClick={() => setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: [...bearbeiteRezept.zubereitung, ''] })}
        className="text-xs font-medium px-3 py-2 rounded-xl"
        style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}
      >
        + Schritt
      </button>
      <button
        onClick={() => einzelnRezeptGenerieren(gericht)}
        className="text-xs font-medium px-3 py-2 rounded-xl"
        style={{ background: 'var(--surface)', color: 'var(--near-black)' }}
      >
        ✨ Rezept neu generieren
      </button>
    </div>
  </div>
)}
```

- [ ] **Schritt 8: API-Route `PATCH /api/gerichte/[id]` für rezept-Feld erweitern**

In `app/app/api/gerichte/[id]/route.ts` den body-Typ und updates erweitern:

```typescript
const body = await request.json() as {
  zutaten?: Zutat[]
  bewertung?: number
  rezept?: { zutaten: string[]; zubereitung: string[] } | null
}

const updates: Record<string, unknown> = {}
if (body.zutaten !== undefined) updates.zutaten = body.zutaten
if (body.bewertung !== undefined) updates.bewertung = body.bewertung
if (body.rezept !== undefined) updates.rezept = body.rezept
```

- [ ] **Schritt 9: TypeScript-Check**

```bash
cd app && npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Schritt 10: Committen**

```bash
git add app/app/gerichte/page.tsx app/app/api/gerichte/[id]/route.ts
git commit -m "feat: Gerichte-Seite — Rezept anzeigen, bearbeiten und generieren"
```

---

## Task 8: Manuelle End-to-End-Tests

- [ ] **Schritt 1: Dev-Server starten**

```bash
cd app && npm run dev
```

- [ ] **Schritt 2: DB-Migration prüfen**

Im Supabase-Dashboard SQL-Editor: `SELECT column_name FROM information_schema.columns WHERE table_name = 'gerichte' AND column_name = 'rezept';`
Erwartet: 1 Zeile mit `rezept`.

- [ ] **Schritt 3: Rezept für ein Gericht generieren**

- Gerichte-Seite öffnen
- Ein Gericht aufklappen → "Bearbeiten" → "✨ Rezept neu generieren" klicken
- Erwartet: Zubereitungsschritte erscheinen nach ~5s

- [ ] **Schritt 4: Bottom Sheet im Wochenplan testen**

- Wochenplan-Seite öffnen
- Auf einer Karte mit Rezept: "Rezept ansehen →" antippen
- Erwartet: Sheet fährt von unten ein, zeigt Zutaten + Schritte
- Sheet durch Tap auf Hintergrund schließen: erwartet dass es sich schließt

- [ ] **Schritt 5: Reload-Test**

- Seite neu laden
- Erwartet: Rezept-Link auf Karten ist noch vorhanden (Daten kommen aus DB)

- [ ] **Schritt 6: Finales Commit**

```bash
git add -A
git commit -m "feat: Rezepte-Feature vollständig implementiert"
```
