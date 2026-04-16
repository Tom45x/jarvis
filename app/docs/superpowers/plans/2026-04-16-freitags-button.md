# Freitags-Button & Genehmigen-Pill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der "Plan erstellen"-Button erscheint nur freitags (mit Bearbeiten-Icon, gestapelt über dem Einkauf-Button), der Genehmigen-Button wandert als grüner Pill in den Seiten-Header, und der Einkauf-Button ist gesperrt solange der Plan im Entwurf-Status ist.

**Architecture:** Reine UI-Änderung. `WochenplanGrid` verliert `onGenehmigen` (Button zieht in `page.tsx`). `page.tsx` bekommt Freitags-Logik, neuen Header und neue Action Bar. Kein API-Change.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS, Jest + React Testing Library

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `app/components/WochenplanGrid.tsx` | `onGenehmigen`-Prop + Button entfernen |
| `app/__tests__/components/WochenplanGrid.test.tsx` | Tests für Genehmigen-Button entfernen, `onGenehmigen` aus allen Render-Calls entfernen |
| `app/app/wochenplan/page.tsx` | Header-Pill, neue Action Bar, `onGenehmigen` aus Grid-Aufruf entfernen |

---

### Task 1: WochenplanGrid — onGenehmigen entfernen

**Files:**
- Modify: `app/components/WochenplanGrid.tsx:83-93` (Interface + Button-Block)
- Test: `app/__tests__/components/WochenplanGrid.test.tsx`

- [ ] **Step 1: Tests anpassen (zuerst — TDD)**

Öffne `app/__tests__/components/WochenplanGrid.test.tsx`. Ersetze den gesamten Inhalt mit:

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
    render(<WochenplanGrid carryOverPlan={null} aktiverPlan={mockPlan} gerichte={mockGerichte} onTauschen={() => {}} onWaehlen={() => {}} onRezept={() => {}} />)
    expect(screen.getByText('Flickerklopse')).toBeInTheDocument()
    expect(screen.getByText('Pizza Margherita')).toBeInTheDocument()
  })

  it('ruft onTauschen auf wenn Tauschen-Button zweimal geklickt wird', () => {
    const onTauschen = jest.fn()
    render(<WochenplanGrid carryOverPlan={null} aktiverPlan={mockPlan} gerichte={mockGerichte} onTauschen={onTauschen} onWaehlen={() => {}} onRezept={() => {}} />)
    const buttons = screen.getAllByLabelText(/tauschen/i)
    fireEvent.click(buttons[0])
    fireEvent.click(screen.getAllByLabelText(/zufällig tauschen/i)[0])
    expect(onTauschen).toHaveBeenCalled()
  })

  it('zeigt keinen Genehmigen-Button im Grid', () => {
    render(<WochenplanGrid carryOverPlan={null} aktiverPlan={mockPlan} gerichte={mockGerichte} onTauschen={() => {}} onWaehlen={() => {}} onRezept={() => {}} />)
    expect(screen.queryByText(/plan genehmigen/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Tests laufen lassen — erwarte Fehler**

```bash
cd app && npx jest WochenplanGrid --no-coverage
```

Erwartetes Ergebnis: TypeScript-Fehler wegen `onGenehmigen` (noch nicht entfernt) — das ist korrekt.

- [ ] **Step 3: WochenplanGrid.tsx anpassen**

In `app/components/WochenplanGrid.tsx`:

**3a — Interface ändern** (Zeile 85-93): `onGenehmigen` aus `WochenplanGridProps` entfernen:

```typescript
interface WochenplanGridProps {
  carryOverPlan: Wochenplan | null
  aktiverPlan: Wochenplan | null
  gerichte: Gericht[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onWaehlen: (tag: string, mahlzeit: string, gericht: Gericht) => void
  onRezept: (gericht: Gericht) => void
}
```

**3b — Funktions-Signatur ändern** (Zeile 95): `onGenehmigen` entfernen:

```typescript
export function WochenplanGrid({ carryOverPlan, aktiverPlan, gerichte, onTauschen, onWaehlen, onRezept }: WochenplanGridProps) {
```

**3c — Button-Block entfernen** (Zeilen 270-280): Den gesamten Block löschen:

```tsx
// DIESEN BLOCK LÖSCHEN:
{aktiverPlan?.status === 'entwurf' && (
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
```

- [ ] **Step 4: Tests laufen lassen — erwarte grün**

```bash
cd app && npx jest WochenplanGrid --no-coverage
```

Erwartetes Ergebnis: 3 Tests PASS

- [ ] **Step 5: Commit**

```bash
cd app && git add app/components/WochenplanGrid.tsx app/__tests__/components/WochenplanGrid.test.tsx
git commit -m "refactor: onGenehmigen aus WochenplanGrid entfernen — Pill wandert in Header"
```

---

### Task 2: page.tsx — Header-Pill + neue Action Bar

**Files:**
- Modify: `app/app/wochenplan/page.tsx`

- [ ] **Step 1: `istFreitag`-Variable hinzufügen**

In `app/app/wochenplan/page.tsx`, direkt vor dem `return`-Statement (nach den `async`-Funktionen, vor `const hatPlan`), folgende Zeile einfügen:

```typescript
const istFreitag = new Date().getDay() === 5
const einkaufAktiv = aktiverPlan?.status === 'genehmigt' || (!aktiverPlan && carryOverPlan !== null)
```

- [ ] **Step 2: `onGenehmigen` aus WochenplanGrid-Aufruf entfernen**

In der JSX, den WochenplanGrid-Aufruf anpassen — `onGenehmigen={genehmigen}` entfernen:

```tsx
<WochenplanGrid
  carryOverPlan={carryOverPlan}
  aktiverPlan={aktiverPlan}
  gerichte={gerichte}
  onTauschen={tauschen}
  onWaehlen={waehlen}
  onRezept={setRezeptGericht}
/>
```

- [ ] **Step 3: Header-Statuszeile ersetzen**

Den bestehenden `<p>`-Tag mit dem Status (Zeile ~160-163) ersetzen durch eine Flex-Zeile mit optionalem Genehmigen-Pill:

```tsx
<div className="flex items-center justify-between mt-0.5">
  <p className="text-sm" style={{
    color: aktiverPlan?.status === 'entwurf'
      ? 'var(--rausch)'
      : aktiverPlan?.status === 'genehmigt'
      ? '#00a651'
      : 'var(--gray-secondary)'
  }}>
    {aktiverPlan
      ? aktiverPlan.status === 'genehmigt' ? '✓ Genehmigt' : 'Entwurf — nicht genehmigt'
      : carryOverPlan ? 'Nächste Woche noch nicht geplant' : 'Noch kein Plan für diese Woche'}
  </p>
  {aktiverPlan?.status === 'entwurf' && (
    <button
      onClick={genehmigen}
      className="flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5 active:opacity-70 transition-opacity"
      style={{ background: '#00a651', color: '#ffffff' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Genehmigen
    </button>
  )}
</div>
```

- [ ] **Step 4: Action Bar komplett ersetzen**

Den gesamten `{/* Thumb-Zone Action Bar */}`-Block (Zeilen 193-262) ersetzen mit:

```tsx
{/* Thumb-Zone Action Bar */}
<div
  className="fixed left-0 right-0 px-4 pb-2 pt-3 z-50"
  style={{
    bottom: 'calc(64px + env(safe-area-inset-bottom, 34px))',
    background: 'linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0))',
  }}
>
  <div className="flex flex-col gap-2">
    {istFreitag && (
      <button
        onClick={generieren}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
        style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '52px' }}
      >
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

    {(hatPlan || istFreitag) && (
      einkaufslisteDaten ? (
        <button
          onClick={() => setEinkaufslisteOffen(true)}
          className="w-full flex flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
          style={{ background: 'var(--near-black)', color: '#ffffff', minHeight: '52px' }}
        >
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            Einkaufsliste ansehen
          </div>
          {einkaufMeldung && (
            <span className="text-xs font-normal opacity-70">{einkaufMeldung.replace(/^✅\s*/, '')}</span>
          )}
        </button>
      ) : (
        <button
          onClick={einkaufslisteSenden}
          disabled={!einkaufAktiv || einkaufLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
          style={{
            background: einkaufAktiv ? 'var(--near-black)' : 'var(--surface)',
            color: einkaufAktiv ? '#ffffff' : 'var(--gray-secondary)',
            minHeight: '52px',
          }}
        >
          {einkaufLoading ? 'Sende...' : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Einkaufslisten senden
            </>
          )}
        </button>
      )
    )}
  </div>
</div>
```

- [ ] **Step 5: Leerzustand anpassen**

Den bestehenden Leerzustand-Block (zeigt nur wenn `!hatPlan`) anpassen — der "Plan erstellen"-Button im Leerzustand entfällt, da er jetzt in der Action Bar ist. Der Block bleibt, aber ohne Button:

```tsx
{!hatPlan && (
  <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
    <div className="text-5xl mb-4">🍽️</div>
    <p className="text-lg font-semibold mb-2" style={{ color: 'var(--near-black)' }}>
      Noch kein Plan
    </p>
    <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
      {istFreitag ? 'Tippe unten auf "Plan erstellen"' : 'Am Freitag kann Jarvis einen neuen Plan erstellen'}
    </p>
  </div>
)}
```

- [ ] **Step 6: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 7: Alle Tests laufen lassen**

```bash
cd app && npx jest --no-coverage
```

Erwartetes Ergebnis: Alle Tests PASS.

- [ ] **Step 8: Commit**

```bash
cd app && git add app/app/wochenplan/page.tsx
git commit -m "feat: Freitags-Button mit Bearbeiten-Icon, Genehmigen-Pill im Header, Einkauf-Sperre"
```
