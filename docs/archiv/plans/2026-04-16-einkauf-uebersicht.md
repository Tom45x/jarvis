# Einkaufsübersicht & Wochenplan-Übersicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einkaufsübersicht mit farbigen Blöcken redesignen und eine neue read-only Wochenplan-Übersichtsseite (Mo–So) bauen, die sich im Querformat automatisch zum Tabellen-Grid umschaltet.

**Architecture:** Feature 1 modifiziert die bestehende `EinkaufslisteSheet`-Komponente — kein neuer State, nur JSX-Umbau + neuer Navigationsbutton. Feature 2 ist eine neue Next.js Client-Page die den aktiven Plan aus `/api/wochenplan` lädt und per `matchMedia`-Hook zwischen Portrait/Landscape-Layout wechselt.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, `apiFetch` aus `@/lib/api-fetch`

---

## Dateiübersicht

| Datei | Aktion | Was sich ändert |
|---|---|---|
| `app/components/EinkaufslisteSheet.tsx` | Modifizieren | Farbige Blöcke, Gesamtanzahl im Header, „Wochenplan ansehen"-Button |
| `app/app/wochenplan/uebersicht/page.tsx` | Neu erstellen | Read-only Wochenplan-Übersicht, Portrait + Landscape-Layout |

---

## Task 1: EinkaufslisteSheet — farbige Blöcke

**Files:**
- Modify: `app/components/EinkaufslisteSheet.tsx`

### Kontext

Der bestehende Sheet zeigt drei Listen (Picnic, Bring1, Bring2) mit einfacher Trennlinie. Ziel: jede Route als farbigen Block mit Badge + Artikelanzahl. Außerdem Gesamtanzahl im Header und ein Button am Ende der zum Wochenplan navigiert.

Die Komponente bekommt `useRouter` aus `next/navigation` neu.

- [ ] **Schritt 1: `useRouter`-Import hinzufügen**

In `app/components/EinkaufslisteSheet.tsx` den Import ergänzen:

```tsx
import { useRouter } from 'next/navigation'
```

Und in der Komponente `EinkaufslisteSheet` direkt nach den bestehenden State-Variablen:

```tsx
const router = useRouter()
```

- [ ] **Schritt 2: `PicnicLogo`- und `BringLogo`-Komponenten entfernen**

Diese werden durch die neuen farbigen Blöcke ersetzt. Beide Funktionen (`PicnicLogo` und `BringLogo`, Zeilen 18–38) löschen.

- [ ] **Schritt 3: Gesamtanzahl berechnen**

In der `EinkaufslisteSheet`-Komponente, direkt nach den `aggregiere`-Aufrufen in Zeile 60–62, hinzufügen:

```tsx
const gesamtArtikel = picnic.length + bring1.length + bring2.length
```

- [ ] **Schritt 4: JSX komplett ersetzen**

Den kompletten `return`-Block der `EinkaufslisteSheet`-Komponente (ab `return (` bis zum letzten `</>`) ersetzen:

```tsx
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

      <div className="overflow-y-auto px-5 pb-10" style={{ maxHeight: 'calc(80vh - 40px)' }}>
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

        {/* Picnic Block */}
        {picnic.length > 0 && (
          <div
            className="rounded-xl p-3 mb-3"
            style={{ background: '#f0fae8' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#5ba832', color: '#ffffff', fontSize: '10px' }}
              >
                Picnic
              </span>
              <span className="text-xs font-semibold" style={{ color: '#5ba832' }}>
                {picnic.length} Artikel
              </span>
            </div>
            <ItemListe items={picnic} />
          </div>
        )}

        {/* Bring Einkauf 1 Block */}
        {bring1.length > 0 && (
          <div
            className="rounded-xl p-3 mb-3"
            style={{ background: '#fff5ed' }}
          >
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
          <div
            className="rounded-xl p-3 mb-5"
            style={{ background: '#fff5ed' }}
          >
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

        {/* Wochenplan-Button */}
        <button
          onClick={() => { onClose(); router.push('/wochenplan/uebersicht') }}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
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
      </div>
    </div>
  </>
)
```

- [ ] **Schritt 5: Testen**

```bash
cd app && npm run dev
```

- Wochenplan-Seite öffnen → Einkaufslisten senden → Sheet öffnet sich
- Prüfen: Picnic-Block grün, Bring-Blöcke orange, Gesamtzahl im Header
- „Wochenplan ansehen"-Button antippen → navigiert zu `/wochenplan/uebersicht` (404 erwartet, kommt in Task 2)
- Sheet schließt sich beim Klick auf den Button

- [ ] **Schritt 6: Commit**

```bash
cd app && git add components/EinkaufslisteSheet.tsx
git commit -m "feat: Einkaufsübersicht mit farbigen Blöcken und Wochenplan-Button"
```

---

## Task 2: Wochenplan-Übersicht Seite

**Files:**
- Create: `app/app/wochenplan/uebersicht/page.tsx`

### Kontext

Neue Client-Page die den aktiven Plan lädt und alle 7 Tage (Mo → So) mit Frühstück/Mittag/Abend anzeigt. Im Hochformat: Kreis-Icon + 3 Mahlzeit-Karten pro Zeile. Im Querformat: automatisches Tabellen-Grid via `matchMedia`. Kein Bearbeiten, nur Zurück-Button.

- [ ] **Schritt 1: Verzeichnis anlegen und Datei erstellen**

Datei `app/app/wochenplan/uebersicht/page.tsx` mit folgendem Inhalt erstellen:

```tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import type { Wochenplan, Mahlzeit } from '@/types'

const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const
type Tag = typeof TAGE[number]

const TAG_SHORT: Record<Tag, string> = {
  montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi', donnerstag: 'Do',
  freitag: 'Fr', samstag: 'Sa', sonntag: 'So',
}

const MAHLZEITEN: Mahlzeit[] = ['frühstück', 'mittag', 'abend']

const MAHLZEIT_LABEL: Record<Mahlzeit, string> = {
  frühstück: 'Früh',
  mittag: 'Mittag',
  abend: 'Abend',
}

const JS_TAGE = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']

function istHeute(tag: Tag): boolean {
  return JS_TAGE[new Date().getDay()] === tag
}

export default function WochenplanUebersichtPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<Wochenplan | null>(null)
  const [istLandscape, setIstLandscape] = useState(false)

  useEffect(() => {
    apiFetch('/api/wochenplan')
      .then(r => r.ok ? r.json() : null)
      .then((data: { aktiverPlan: Wochenplan | null } | null) => {
        if (data?.aktiverPlan) setPlan(data.aktiverPlan)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    setIstLandscape(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIstLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function gerichtName(tag: Tag, mahlzeit: Mahlzeit): string {
    return plan?.eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit)?.gericht_name ?? '—'
  }

  const backButton = (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
      style={{ color: 'var(--rausch)' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  // ── Portrait Layout ──────────────────────────────────────────────
  if (!istLandscape) {
    return (
      <main className="min-h-screen bg-white pb-24">
        <div className="px-4 pt-12 pb-4 flex items-center gap-3">
          {backButton}
          <h1 className="text-xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
            Diese Woche
          </h1>
        </div>

        <div className="px-4 space-y-1.5">
          {TAGE.map(tag => (
            <div
              key={tag}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr', gap: '6px', alignItems: 'center' }}
            >
              {/* Kreis-Icon */}
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: istHeute(tag) ? 'var(--rausch)' : 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: istHeute(tag) ? '#ffffff' : 'var(--near-black)',
                  flexShrink: 0,
                }}
              >
                {TAG_SHORT[tag]}
              </div>

              {/* Mahlzeit-Karten */}
              {MAHLZEITEN.map(mahlzeit => (
                <div
                  key={mahlzeit}
                  className="rounded-lg"
                  style={{ background: '#fffbf0', padding: '6px 8px', boxShadow: 'var(--card-shadow)' }}
                >
                  <p style={{ fontSize: '9px', color: 'var(--gray-secondary)', marginBottom: '2px' }}>
                    {MAHLZEIT_LABEL[mahlzeit]}
                  </p>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--near-black)', lineHeight: '1.2' }}>
                    {gerichtName(tag, mahlzeit)}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    )
  }

  // ── Landscape Layout ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white pb-8">
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        {backButton}
        <h1 className="text-lg font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
          Diese Woche
        </h1>
      </div>

      <div className="px-4">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '44px repeat(7, 1fr)',
            gap: '4px',
          }}
        >
          {/* Leer-Ecke oben links */}
          <div />

          {/* Tag-Spalten-Header */}
          {TAGE.map(tag => (
            <div key={tag} style={{ display: 'flex', justifyContent: 'center', paddingBottom: '4px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: istHeute(tag) ? 'var(--rausch)' : 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: istHeute(tag) ? '#ffffff' : 'var(--near-black)',
                }}
              >
                {TAG_SHORT[tag]}
              </div>
            </div>
          ))}

          {/* Mahlzeit-Zeilen */}
          {MAHLZEITEN.map(mahlzeit => (
            <React.Fragment key={mahlzeit}>
              {/* Zeilen-Label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--gray-secondary)',
                  paddingRight: '6px',
                }}
              >
                {MAHLZEIT_LABEL[mahlzeit]}
              </div>

              {/* Zellen */}
              {TAGE.map(tag => (
                <div
                  key={`${tag}-${mahlzeit}`}
                  className="rounded-lg"
                  style={{
                    background: '#fffbf0',
                    padding: '6px 4px',
                    textAlign: 'center',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--near-black)', lineHeight: '1.3' }}>
                    {gerichtName(tag, mahlzeit)}
                  </p>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Schritt 2: Hochformat testen**

```bash
cd app && npm run dev
```

Browser öffnen (http://192.168.2.31:3000 oder http://localhost:3000):

- Direkt zu `/wochenplan/uebersicht` navigieren
- Prüfen: 7 Zeilen (Mo → So) sichtbar, jede Zeile hat Kreis + 3 Karten
- Heutiger Tag: Rausch-Rot Kreis, andere: grau
- Gerichtnamen werden geladen (oder `—` wenn kein Plan)
- Zurück-Button navigiert zurück

- [ ] **Schritt 3: Querformat testen**

Im Browser DevTools auf ein iPhone umschalten, dann auf Landscape drehen (oder: DevTools → Responsive → Landscape). Alternativ auf echtem Gerät testen.

- Prüfen: automatischer Wechsel zum Tabellen-Grid (3 Zeilen × 7 Spalten)
- Prüfen: alle Gerichtnamen lesbar, kein horizontales Scrollen
- Zurück-Button weiterhin sichtbar

- [ ] **Schritt 4: Navigation vom Sheet testen**

- Wochenplan-Seite → Einkaufslisten senden → Sheet öffnen → „Wochenplan ansehen" antippen
- Sheet schließt sich, Seite `/wochenplan/uebersicht` öffnet sich
- Zurück-Button → zurück zur Wochenplan-Seite

- [ ] **Schritt 5: Commit**

```bash
cd app && git add app/wochenplan/uebersicht/page.tsx
git commit -m "feat: Wochenplan-Übersicht Seite (Portrait + Landscape)"
```

---

## Abschluss

Nach beiden Tasks:

```bash
cd app && npm run build
```

Erwartetes Ergebnis: Build erfolgreich ohne TypeScript-Fehler.
