# Gericht hinzufügen — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Katja kann auf der Gerichte-Seite manuell ein neues Gericht anlegen — per KI-Generierung oder manueller Eingabe.

**Architecture:** Nur `app/app/gerichte/page.tsx` wird geändert. Alle API-Endpunkte existieren bereits. Neuer State und zwei neue async-Funktionen werden direkt in die bestehende Seitenkomponente eingefügt. Der Button erscheint zwischen "Neue Gerichte entdecken" und dem Kategorie-Filter.

**Tech Stack:** Next.js App Router, React useState, `apiFetch` (`@/lib/api-fetch`), `@testing-library/react` + Jest.

---

## Dateien

- Modify: `app/app/gerichte/page.tsx`
- Test: `app/__tests__/pages/gerichte-page.test.tsx` (neu)

---

## Task 1: State + Reset + Button

**Files:**
- Modify: `app/app/gerichte/page.tsx:8–31` (State-Block)
- Modify: `app/app/gerichte/page.tsx:212` (nach `loeschen`-Funktion)
- Modify: `app/app/gerichte/page.tsx:243` (JSX — nach "Neue Gerichte entdecken")
- Test: `app/__tests__/pages/gerichte-page.test.tsx`

- [ ] **Schritt 1: Test-Datei anlegen und erste Tests schreiben**

Erstelle `app/__tests__/pages/gerichte-page.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GerichtePage from '@/app/gerichte/page'
import { apiFetch } from '@/lib/api-fetch'

jest.mock('@/lib/api-fetch')
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

function makeResponse(data: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(data) } as unknown as Response
}

beforeEach(() => {
  mockApiFetch.mockResolvedValue(makeResponse([]))
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('Neues Gericht — Button', () => {
  it('zeigt "＋ Neues Gericht hinzufügen" Button', async () => {
    render(<GerichtePage />)
    await waitFor(() => {
      expect(screen.getByText('＋ Neues Gericht hinzufügen')).toBeInTheDocument()
    })
  })

  it('öffnet Formular beim Klick', async () => {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    expect(screen.getByPlaceholderText('Name des Gerichts')).toBeInTheDocument()
  })

  it('versteckt Button wenn Formular offen', async () => {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    expect(screen.queryByText('＋ Neues Gericht hinzufügen')).not.toBeInTheDocument()
  })

  it('schließt Formular per Abbrechen', async () => {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('Abbrechen'))
    expect(screen.queryByPlaceholderText('Name des Gerichts')).not.toBeInTheDocument()
    expect(screen.getByText('＋ Neues Gericht hinzufügen')).toBeInTheDocument()
  })
})
```

- [ ] **Schritt 2: Tests fehlschlagen lassen**

```bash
cd app && npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: FAIL — "Cannot find module" oder Element nicht gefunden.

- [ ] **Schritt 3: State und Reset-Funktion in `app/app/gerichte/page.tsx` einfügen**

Nach Zeile 30 (`const [expandedId, setExpandedId] = useState<string | null>(null)`) die 8 neuen State-Variablen einfügen:

```ts
  const [neuesGerichtOffen, setNeuesGerichtOffen] = useState(false)
  const [neuesGerichtName, setNeuesGerichtName] = useState('')
  const [neuesGerichtModus, setNeuesGerichtModus] = useState<'generieren' | 'manuell' | null>(null)
  const [neuesGerichtKategorie, setNeuesGerichtKategorie] = useState('sonstiges')
  const [neuesGerichtAufwand, setNeuesGerichtAufwand] = useState('30 Min')
  const [neuesGerichtZutatenOffen, setNeuesGerichtZutatenOffen] = useState(false)
  const [neuesGerichtZutaten, setNeuesGerichtZutaten] = useState<Zutat[]>([])
  const [neuesGerichtLaedt, setNeuesGerichtLaedt] = useState(false)
```

Nach der `loeschen`-Funktion (nach Zeile 212) die Reset-Funktion einfügen:

```ts
  function neuesGerichtZuruecksetzen() {
    setNeuesGerichtOffen(false)
    setNeuesGerichtName('')
    setNeuesGerichtModus(null)
    setNeuesGerichtKategorie('sonstiges')
    setNeuesGerichtAufwand('30 Min')
    setNeuesGerichtZutatenOffen(false)
    setNeuesGerichtZutaten([])
    setNeuesGerichtLaedt(false)
  }
```

- [ ] **Schritt 4: Button und leeres Formular-Gerüst in JSX einfügen**

Im return-Block, direkt nach dem schließenden `</div>` der "Neue Gerichte entdecken"-Sektion (nach Zeile ~338) und vor `{/* Kategorie-Filter */}` einfügen:

```tsx
      {/* Neues Gericht hinzufügen */}
      {!neuesGerichtOffen && (
        <div className="mx-4 mb-4">
          <button
            onClick={() => setNeuesGerichtOffen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold active:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: 'var(--near-black)', minHeight: '52px', boxShadow: 'var(--card-shadow)' }}
          >
            ＋ Neues Gericht hinzufügen
          </button>
        </div>
      )}

      {neuesGerichtOffen && (
        <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--near-black)' }}>
            Neues Gericht
          </h2>
          <input
            type="text"
            value={neuesGerichtName}
            onChange={e => setNeuesGerichtName(e.target.value)}
            placeholder="Name des Gerichts"
            className="w-full rounded-xl outline-none mb-3"
            style={{ background: '#ffffff', border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', padding: '12px 14px', minHeight: '48px' }}
          />
          {/* Modus-Buttons, Pfade und Abbrechen folgen in Task 2 & 3 */}
          <button
            onClick={neuesGerichtZuruecksetzen}
            className="w-full text-sm font-medium py-2.5 rounded-xl mt-2"
            style={{ background: '#f0f0f0', color: 'var(--near-black)' }}
          >
            Abbrechen
          </button>
        </div>
      )}
```

- [ ] **Schritt 5: Tests grün laufen lassen**

```bash
npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: PASS (alle 4 Tests grün).

- [ ] **Schritt 6: Commit**

```bash
git add app/app/gerichte/page.tsx app/__tests__/pages/gerichte-page.test.tsx
git commit -m "feat: Neues-Gericht-Button und Formular-Gerüst"
```

---

## Task 2: Modus-Auswahl + Manuell-Pfad + Speichern

**Files:**
- Modify: `app/app/gerichte/page.tsx` (neue async-Funktion + JSX erweitern)
- Test: `app/__tests__/pages/gerichte-page.test.tsx` (Tests ergänzen)

- [ ] **Schritt 1: Tests für Modus-Auswahl und Manuell-Pfad schreiben**

In `gerichte-page.test.tsx` ergänzen:

```tsx
describe('Neues Gericht — Manuell-Pfad', () => {
  async function oeffneFormular() {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
  }

  it('zeigt Kategorie-Dropdown nach Klick auf Manuell', async () => {
    await oeffneFormular()
    fireEvent.click(screen.getByText('✍️ Manuell'))
    expect(screen.getByDisplayValue('sonstiges')).toBeInTheDocument()
  })

  it('zeigt Aufwand-Dropdown nach Klick auf Manuell', async () => {
    await oeffneFormular()
    fireEvent.click(screen.getByText('✍️ Manuell'))
    expect(screen.getByDisplayValue('30 Min')).toBeInTheDocument()
  })

  it('Speichern-Button ist deaktiviert wenn Name leer', async () => {
    await oeffneFormular()
    fireEvent.click(screen.getByText('✍️ Manuell'))
    expect(screen.getByText('Speichern')).toBeDisabled()
  })

  it('manuell: POST /api/gerichte mit korrekten Daten', async () => {
    const neuesGericht = { id: '99', name: 'Testgericht', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell', aufwand: '30 Min', bewertung: 3, tausch_count: 0, gesperrt: false }
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/gerichte' && opts?.method === 'POST')
        return Promise.resolve(makeResponse(neuesGericht))
      return Promise.resolve(makeResponse([]))
    })

    await oeffneFormular()
    fireEvent.change(screen.getByPlaceholderText('Name des Gerichts'), { target: { value: 'Testgericht' } })
    fireEvent.click(screen.getByText('✍️ Manuell'))
    fireEvent.click(screen.getByText('Speichern'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/gerichte', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Testgericht', kategorie: 'sonstiges', aufwand: '30 Min', gesund: false, quelle: 'manuell' }),
      }))
    })
  })

  it('manuell: Formular schließt sich nach erfolgreichem Speichern', async () => {
    const neuesGericht = { id: '99', name: 'Testgericht', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell', aufwand: '30 Min', bewertung: 3, tausch_count: 0, gesperrt: false }
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/gerichte' && opts?.method === 'POST')
        return Promise.resolve(makeResponse(neuesGericht))
      return Promise.resolve(makeResponse([]))
    })

    await oeffneFormular()
    fireEvent.change(screen.getByPlaceholderText('Name des Gerichts'), { target: { value: 'Testgericht' } })
    fireEvent.click(screen.getByText('✍️ Manuell'))
    fireEvent.click(screen.getByText('Speichern'))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Name des Gerichts')).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Schritt 2: Tests fehlschlagen lassen**

```bash
npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: FAIL — Manuell-Button, Kategorie-Dropdown und Speichern-Button noch nicht vorhanden.

- [ ] **Schritt 3: `neuesGerichtSpeichern`-Funktion in `page.tsx` einfügen**

Nach der `neuesGerichtZuruecksetzen`-Funktion einfügen:

```ts
  async function neuesGerichtSpeichern() {
    setNeuesGerichtLaedt(true)
    try {
      const res = await apiFetch('/api/gerichte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: neuesGerichtName.trim(),
          kategorie: neuesGerichtKategorie,
          aufwand: neuesGerichtAufwand,
          gesund: false,
          quelle: 'manuell',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Anlegen fehlgeschlagen')
      const zutatenGefiltert = neuesGerichtZutaten.filter(z => z.name.trim())
      if (zutatenGefiltert.length > 0) {
        await apiFetch(`/api/gerichte/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zutaten: zutatenGefiltert }),
        })
      }
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setMeldung(`✅ ${neuesGerichtName.trim()} hinzugefügt`)
      neuesGerichtZuruecksetzen()
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setNeuesGerichtLaedt(false)
    }
  }
```

- [ ] **Schritt 4: Formular-JSX um Modus-Buttons und Manuell-Pfad erweitern**

Den Placeholder-Kommentar `{/* Modus-Buttons, Pfade und Abbrechen folgen in Task 2 & 3 */}` **und** den bestehenden Abbrechen-Button durch folgenden Block ersetzen:

```tsx
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setNeuesGerichtModus('generieren')}
              className="flex-1 text-sm font-semibold py-2.5 rounded-xl active:opacity-70"
              style={{
                background: neuesGerichtModus === 'generieren' ? 'var(--near-black)' : '#ffffff',
                color: neuesGerichtModus === 'generieren' ? '#ffffff' : 'var(--near-black)',
                border: '1.5px solid var(--border)',
              }}
            >
              ✨ Generieren
            </button>
            <button
              onClick={() => setNeuesGerichtModus('manuell')}
              className="flex-1 text-sm font-semibold py-2.5 rounded-xl active:opacity-70"
              style={{
                background: neuesGerichtModus === 'manuell' ? 'var(--near-black)' : '#ffffff',
                color: neuesGerichtModus === 'manuell' ? '#ffffff' : 'var(--near-black)',
                border: '1.5px solid var(--border)',
              }}
            >
              ✍️ Manuell
            </button>
          </div>

          {/* Manuell-Pfad */}
          {neuesGerichtModus === 'manuell' && (
            <>
              <div className="flex gap-2 mb-3">
                <select
                  value={neuesGerichtKategorie}
                  onChange={e => setNeuesGerichtKategorie(e.target.value)}
                  className="flex-1 rounded-xl px-3"
                  style={{ border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', minHeight: '48px', background: '#ffffff' }}
                >
                  {['fleisch', 'nudeln', 'suppe', 'auflauf', 'fisch', 'salat', 'sonstiges', 'kinder', 'trainingstage', 'frühstück', 'filmabend'].map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <select
                  value={neuesGerichtAufwand}
                  onChange={e => setNeuesGerichtAufwand(e.target.value)}
                  className="rounded-xl px-3"
                  style={{ border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', minHeight: '48px', background: '#ffffff' }}
                >
                  {['15 Min', '30 Min', '45 Min', '60+ Min'].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              {/* Zutaten-Toggle folgt in Task 3 */}
              <div className="flex gap-2">
                <button
                  onClick={neuesGerichtSpeichern}
                  disabled={!neuesGerichtName.trim() || neuesGerichtLaedt}
                  className="flex-1 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 active:opacity-70"
                  style={{ background: 'var(--near-black)', color: '#ffffff' }}
                >
                  {neuesGerichtLaedt ? '...' : 'Speichern'}
                </button>
                <button
                  onClick={neuesGerichtZuruecksetzen}
                  className="text-sm font-medium px-4 py-2.5 rounded-xl"
                  style={{ background: '#f0f0f0', color: 'var(--near-black)' }}
                >
                  Abbrechen
                </button>
              </div>
            </>
          )}

          {/* Abbrechen wenn kein Modus oder Generieren-Modus */}
          {neuesGerichtModus !== 'manuell' && (
            <button
              onClick={neuesGerichtZuruecksetzen}
              className="w-full text-sm font-medium py-2.5 rounded-xl mt-2"
              style={{ background: '#f0f0f0', color: 'var(--near-black)' }}
            >
              Abbrechen
            </button>
          )}
```

- [ ] **Schritt 5: Tests grün laufen lassen**

```bash
npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: PASS (alle bisherigen Tests + die 5 neuen Tests grün).

- [ ] **Schritt 6: Commit**

```bash
git add app/app/gerichte/page.tsx app/__tests__/pages/gerichte-page.test.tsx
git commit -m "feat: Manuell-Pfad mit Kategorie/Aufwand und Speichern"
```

---

## Task 3: Zutaten-Toggle (optionaler Editor im Manuell-Pfad)

**Files:**
- Modify: `app/app/gerichte/page.tsx` (JSX — Zutaten-Toggle einfügen)
- Test: `app/__tests__/pages/gerichte-page.test.tsx` (Tests ergänzen)

- [ ] **Schritt 1: Tests für den Zutaten-Toggle schreiben**

In `gerichte-page.test.tsx` ergänzen:

```tsx
describe('Neues Gericht — Zutaten-Toggle', () => {
  async function oeffneManuell() {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('✍️ Manuell'))
  }

  it('zeigt Toggle-Button', async () => {
    await oeffneManuell()
    expect(screen.getByText('＋ Zutaten & Rezept jetzt hinzufügen')).toBeInTheDocument()
  })

  it('Toggle öffnet Zutaten-Editor', async () => {
    await oeffneManuell()
    fireEvent.click(screen.getByText('＋ Zutaten & Rezept jetzt hinzufügen'))
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
  })

  it('PATCH /api/gerichte/:id wird aufgerufen wenn Zutat ausgefüllt', async () => {
    const neuesGericht = { id: '99', name: 'Testgericht', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell', aufwand: '30 Min', bewertung: 3, tausch_count: 0, gesperrt: false }
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/gerichte' && opts?.method === 'POST')
        return Promise.resolve(makeResponse(neuesGericht))
      return Promise.resolve(makeResponse([]))
    })

    await oeffneManuell()
    fireEvent.change(screen.getByPlaceholderText('Name des Gerichts'), { target: { value: 'Testgericht' } })
    fireEvent.click(screen.getByText('＋ Zutaten & Rezept jetzt hinzufügen'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Nudeln' } })
    fireEvent.click(screen.getByText('Speichern'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/gerichte/99', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Nudeln'),
      }))
    })
  })
})
```

- [ ] **Schritt 2: Tests fehlschlagen lassen**

```bash
npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: FAIL — Toggle-Button noch nicht vorhanden.

- [ ] **Schritt 3: Zutaten-Toggle in JSX einfügen**

Den Kommentar `{/* Zutaten-Toggle folgt in Task 3 */}` in `page.tsx` durch folgenden Block ersetzen:

```tsx
              <button
                onClick={() => {
                  const oeffnen = !neuesGerichtZutatenOffen
                  setNeuesGerichtZutatenOffen(oeffnen)
                  if (oeffnen && neuesGerichtZutaten.length === 0) {
                    setNeuesGerichtZutaten([{ name: '', menge: 0, einheit: 'g', haltbarkeit_tage: 1 }])
                  }
                }}
                className="w-full text-xs font-medium py-2 rounded-xl mb-3"
                style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}
              >
                {neuesGerichtZutatenOffen ? '▲ Zutaten ausblenden' : '＋ Zutaten & Rezept jetzt hinzufügen'}
              </button>

              {neuesGerichtZutatenOffen && (
                <div className="space-y-2 mb-3">
                  {neuesGerichtZutaten.map((zutat, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input
                        value={zutat.name}
                        onChange={e => setNeuesGerichtZutaten(prev => prev.map((z, idx) => idx === i ? { ...z, name: e.target.value } : z))}
                        placeholder="Name"
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '16px' }}
                      />
                      <input
                        type="number"
                        value={zutat.menge}
                        onChange={e => setNeuesGerichtZutaten(prev => prev.map((z, idx) => idx === i ? { ...z, menge: parseFloat(e.target.value) || 0 } : z))}
                        className="px-2 py-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', width: '56px' }}
                      />
                      <select
                        value={zutat.einheit}
                        onChange={e => setNeuesGerichtZutaten(prev => prev.map((z, idx) => idx === i ? { ...z, einheit: e.target.value } : z))}
                        className="px-1 py-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '16px' }}
                      >
                        {['g', 'kg', 'ml', 'l', 'Stück', 'EL', 'TL', 'Bund', 'Packung'].map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setNeuesGerichtZutaten(prev => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70"
                        style={{ background: '#fff0f3', color: 'var(--rausch)' }}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => setNeuesGerichtZutaten(prev => [...prev, { name: '', menge: 0, einheit: 'g', haltbarkeit_tage: 1 }])}
                    className="text-xs font-medium px-3 py-2 rounded-xl"
                    style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}
                  >
                    + Zutat
                  </button>
                </div>
              )}
```

- [ ] **Schritt 4: Tests grün laufen lassen**

```bash
npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: PASS (alle bisherigen Tests + 3 neue Tests grün).

- [ ] **Schritt 5: Commit**

```bash
git add app/app/gerichte/page.tsx app/__tests__/pages/gerichte-page.test.tsx
git commit -m "feat: optionaler Zutaten-Toggle im Manuell-Pfad"
```

---

## Task 4: Generieren-Pfad

**Files:**
- Modify: `app/app/gerichte/page.tsx` (neue async-Funktion + JSX)
- Test: `app/__tests__/pages/gerichte-page.test.tsx` (Tests ergänzen)

- [ ] **Schritt 1: Tests für Generieren-Pfad schreiben**

In `gerichte-page.test.tsx` ergänzen:

```tsx
describe('Neues Gericht — Generieren-Pfad', () => {
  async function oeffneGenerieren(name = 'Testgericht') {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.change(screen.getByPlaceholderText('Name des Gerichts'), { target: { value: name } })
    fireEvent.click(screen.getByText('✨ Generieren'))
  }

  it('zeigt Generieren-Button wenn Generieren gewählt und Name ausgefüllt', async () => {
    await oeffneGenerieren()
    expect(screen.getByText('✨ Zutaten & Rezept generieren')).toBeInTheDocument()
  })

  it('Generieren-Button ist deaktiviert wenn Name leer', async () => {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('✨ Generieren'))
    expect(screen.getByText('✨ Zutaten & Rezept generieren')).toBeDisabled()
  })

  it('ruft POST /api/gerichte → /api/zutaten/generieren → /api/rezepte/generieren auf', async () => {
    const neuesGericht = { id: '99', name: 'Testgericht' }
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/gerichte' && opts?.method === 'POST')
        return Promise.resolve(makeResponse(neuesGericht))
      if (url === '/api/zutaten/generieren')
        return Promise.resolve(makeResponse({ ok: true }))
      if (url === '/api/rezepte/generieren')
        return Promise.resolve(makeResponse({ ok: true }))
      return Promise.resolve(makeResponse([]))
    })

    await oeffneGenerieren('Testgericht')
    fireEvent.click(screen.getByText('✨ Zutaten & Rezept generieren'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/gerichte', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Testgericht', kategorie: 'sonstiges', aufwand: '30 Min', gesund: false, quelle: 'manuell' }),
      }))
      expect(mockApiFetch).toHaveBeenCalledWith('/api/zutaten/generieren', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ gerichtId: '99' }),
      }))
      expect(mockApiFetch).toHaveBeenCalledWith('/api/rezepte/generieren', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ gerichtId: '99' }),
      }))
    })
  })

  it('Formular schließt sich nach Generieren', async () => {
    const neuesGericht = { id: '99', name: 'Testgericht' }
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/gerichte' && opts?.method === 'POST')
        return Promise.resolve(makeResponse(neuesGericht))
      return Promise.resolve(makeResponse([]))
    })

    await oeffneGenerieren('Testgericht')
    fireEvent.click(screen.getByText('✨ Zutaten & Rezept generieren'))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Name des Gerichts')).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Schritt 2: Tests fehlschlagen lassen**

```bash
npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: FAIL — Generieren-Button noch nicht vorhanden.

- [ ] **Schritt 3: `neuesGerichtGenerieren`-Funktion in `page.tsx` einfügen**

Nach `neuesGerichtSpeichern` einfügen:

```ts
  async function neuesGerichtGenerieren() {
    setNeuesGerichtLaedt(true)
    try {
      const res = await apiFetch('/api/gerichte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: neuesGerichtName.trim(),
          kategorie: 'sonstiges',
          aufwand: '30 Min',
          gesund: false,
          quelle: 'manuell',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Anlegen fehlgeschlagen')
      await apiFetch('/api/zutaten/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: data.id }),
      })
      await apiFetch('/api/rezepte/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: data.id }),
      })
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setMeldung(`✅ ${neuesGerichtName.trim()} hinzugefügt`)
      neuesGerichtZuruecksetzen()
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setNeuesGerichtLaedt(false)
    }
  }
```

- [ ] **Schritt 4: Generieren-Pfad in JSX einfügen**

Im Formular-Block, direkt nach dem schließenden `</>` des Manuell-Pfads (vor dem `{neuesGerichtModus !== 'manuell' && ...}`-Block) einfügen:

```tsx
          {/* Generieren-Pfad */}
          {neuesGerichtModus === 'generieren' && (
            <button
              onClick={neuesGerichtGenerieren}
              disabled={!neuesGerichtName.trim() || neuesGerichtLaedt}
              className="w-full text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 active:opacity-70"
              style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '48px' }}
            >
              {neuesGerichtLaedt ? '...' : '✨ Zutaten & Rezept generieren'}
            </button>
          )}
```

- [ ] **Schritt 5: Alle Tests grün laufen lassen**

```bash
npm test -- --testPathPattern="gerichte-page" --no-coverage
```

Erwartet: PASS — alle Tests grün (ca. 16 Tests).

- [ ] **Schritt 6: Gesamte Test-Suite grün**

```bash
npm test --no-coverage
```

Erwartet: PASS — keine Regressionen.

- [ ] **Schritt 7: Commit**

```bash
git add app/app/gerichte/page.tsx app/__tests__/pages/gerichte-page.test.tsx
git commit -m "feat: Generieren-Pfad für neue Gerichte"
```
