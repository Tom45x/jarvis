# Picnic-Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einkaufsliste automatisch zwischen Picnic (Lieferservice) und Bring (persönlicher Einkauf) aufteilen. Fleisch, Fisch, Obst und Gemüse gehen immer nach Bring; alles andere wird auf Picnic gesucht und bei Fund in den Warenkorb gelegt. Ein konfigurierbarer Regelbedarf (Toast, Milch etc.) wird immer zu Picnic hinzugefügt.

**Architecture:** Neue `lib/picnic.ts` kapselt den Picnic-API-Client. Die Entscheidungsmatrix wird als reine Funktion in `lib/einkaufsliste.ts` ergänzt (testbar). Die bestehende `/api/einkaufsliste/senden` Route orchestriert beides parallel. Eine neue `/einstellungen` Seite erlaubt die Pflege von Regelbedarf, Mindestbestellwert und Bring-Keywords.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, `picnic-api` npm package

> **Wichtig:** `picnic-api` ist eine Community-Bibliothek (keine offizielle Picnic API). Nach `npm install picnic-api` die README unter `node_modules/picnic-api/README.md` lesen um exakte Methoden-Signaturen zu prüfen — sie können von diesem Plan abweichen.

---

## Dateistruktur

```
Neu:
  supabase/migration_picnic.sql                DB: regelbedarf Tabelle + einstellungen Einträge
  lib/picnic.ts                                Picnic API Wrapper
  app/api/einstellungen/route.ts               GET + PATCH einstellungen key-value
  app/api/einstellungen/regelbedarf/route.ts   GET + POST regelbedarf
  app/api/einstellungen/regelbedarf/[id]/route.ts  DELETE einzelner Regelbedarf-Artikel
  app/einstellungen/page.tsx                   Einstellungen-UI

Geändert:
  types/index.ts                               + Regelbedarf, PicnicRoutingErgebnis
  lib/einkaufsliste.ts                         + istBringPflicht(), splitNachRouting()
  app/api/einkaufsliste/senden/route.ts        + Picnic-Orchestrierung
  .env.local                                   + PICNIC_EMAIL, PICNIC_PASSWORD
```

---

### Task 1: Abhängigkeiten + Umgebungsvariablen

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: picnic-api installieren**

```bash
cd "C:/Users/thoma/OneDrive/Desktop/Jarvis/app"
npm install picnic-api
```

Erwartete Ausgabe: `added X packages`

- [ ] **Step 2: README lesen**

```bash
cat node_modules/picnic-api/README.md
```

Notiere die exakten Methoden-Namen für: Login, Suche, Warenkorb hinzufügen, Warenkorb leeren. Falls sie von diesem Plan abweichen, in Task 4 (lib/picnic.ts) entsprechend anpassen.

- [ ] **Step 3: Env-Variablen in .env.local ergänzen**

```
PICNIC_EMAIL=deine@email.de
PICNIC_PASSWORD=deinpasswort
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add picnic-api dependency"
```

---

### Task 2: DB-Migration

**Files:**
- Create: `supabase/migration_picnic.sql`

- [ ] **Step 1: Migration-Datei anlegen**

Erstelle `supabase/migration_picnic.sql`:

```sql
-- Regelbedarf: wöchentliche Standard-Artikel die immer zu Picnic gehen
CREATE TABLE IF NOT EXISTS regelbedarf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  menge NUMERIC NOT NULL,
  einheit TEXT NOT NULL
);

INSERT INTO regelbedarf (name, menge, einheit) VALUES
  ('Toast', 1, 'Packung'),
  ('Milch', 2, 'l'),
  ('Butter', 1, 'Packung'),
  ('Eier', 10, 'Stück')
ON CONFLICT DO NOTHING;

-- Picnic-Einstellungen in bestehende einstellungen-Tabelle
INSERT INTO einstellungen (key, value) VALUES
  ('picnic_mindestbestellwert', '35'),
  ('picnic_bring_keywords', '["Hähnchen","Rind","Schwein","Lachs","Thunfisch","Garnelen","Forelle","Dorade","Wolfsbarsch","Apfel","Birne","Banane","Erdbeere","Tomate","Gurke","Zucchini","Paprika","Brokkoli","Karotte","Möhre","Spinat","Salat","Fenchel","Kohlrabi","Lauch","Zwiebel","Knoblauch"]')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Migration im Supabase Dashboard ausführen**

1. Supabase Dashboard → SQL Editor
2. Inhalt von `migration_picnic.sql` einfügen → Run
3. Prüfen: "Success"

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_picnic.sql
git commit -m "feat: add regelbedarf table and picnic einstellungen"
```

---

### Task 3: Types erweitern

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Neue Types ans Ende von types/index.ts anhängen**

```typescript
export interface Regelbedarf {
  id: string
  name: string
  menge: number
  einheit: string
}

export interface PicnicArtikel {
  artikelId: string
  name: string
  preis: number   // in Cent
}

export interface EinkaufsRouting {
  picnic: EinkaufsItem[]
  bring: EinkaufsItem[]
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Regelbedarf, PicnicArtikel, EinkaufsRouting types"
```

---

### Task 4: lib/picnic.ts

**Files:**
- Create: `lib/picnic.ts`

> **Vor diesem Task:** Die exakten Methoden-Namen aus der README (Task 1, Step 2) verwenden. Die Methoden-Namen im Kommentar oben sind Beispiele — verifiziere sie gegen die echte README.

- [ ] **Step 1: Picnic-Wrapper anlegen**

Erstelle `lib/picnic.ts`:

```typescript
// picnic-api Community-Paket: https://www.npmjs.com/package/picnic-api
// Methoden-Namen nach README verifizieren falls Build-Fehler auftreten
import PicnicClient from 'picnic-api'
import type { PicnicArtikel } from '@/types'

// Singleton: Login einmalig pro Server-Lifecycle
let client: InstanceType<typeof PicnicClient> | null = null

async function getClient(): Promise<InstanceType<typeof PicnicClient>> {
  if (!client) {
    client = new PicnicClient()
    await client.login(
      process.env.PICNIC_EMAIL!,
      process.env.PICNIC_PASSWORD!
    )
  }
  return client
}

export async function sucheArtikel(name: string): Promise<PicnicArtikel | null> {
  try {
    const c = await getClient()
    // Methode laut README: search(query) oder searchProducts(query)
    const ergebnis = await c.search(name)
    // Ergebnis-Struktur laut README prüfen — typisch: Array von Produkten
    const items = Array.isArray(ergebnis) ? ergebnis : ergebnis?.items ?? []
    if (items.length === 0) return null
    const erstes = items[0]
    return {
      artikelId: erstes.id ?? erstes.article_id,
      name: erstes.name,
      preis: erstes.price ?? erstes.display_price ?? 0,
    }
  } catch {
    return null
  }
}

export async function zumWarenkorb(artikelId: string, count: number = 1): Promise<void> {
  const c = await getClient()
  // Methode laut README: addProductToCart(id, count) oder addItemToCart(id, count)
  await c.addProductToCart(artikelId, count)
}

export async function warenkorbLeeren(): Promise<void> {
  const c = await getClient()
  // Methode laut README: clearCart() oder setProductCount(id, 0) für jeden Artikel
  await c.clearCart()
}

export async function resetClient(): Promise<void> {
  client = null
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd "C:/Users/thoma/OneDrive/Desktop/Jarvis/app"
npx tsc --noEmit
```

Falls Fehler wegen fehlender Typen für `picnic-api`: TypeScript-Fehler mit `as unknown as ...` umgehen oder eine `declarations.d.ts` anlegen:

```typescript
// lib/declarations.d.ts (nur falls nötig)
declare module 'picnic-api'
```

- [ ] **Step 3: Commit**

```bash
git add lib/picnic.ts lib/declarations.d.ts 2>/dev/null; git add lib/picnic.ts
git commit -m "feat: add picnic API wrapper lib"
```

---

### Task 5: Einstellungen API Routes

**Files:**
- Create: `app/api/einstellungen/route.ts`
- Create: `app/api/einstellungen/regelbedarf/route.ts`
- Create: `app/api/einstellungen/regelbedarf/[id]/route.ts`

- [ ] **Step 1: Einstellungen-Route anlegen**

Erstelle `app/api/einstellungen/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('einstellungen')
    .select('key, value')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Als key→value Objekt zurückgeben
  const result: Record<string, string> = {}
  for (const row of data ?? []) {
    result[row.key] = row.value
  }
  return NextResponse.json(result)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as Record<string, string>

  const upserts = Object.entries(body).map(([key, value]) => ({ key, value }))

  const { error } = await supabase
    .from('einstellungen')
    .upsert(upserts, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Regelbedarf-Route anlegen**

Erstelle `app/api/einstellungen/regelbedarf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('regelbedarf')
    .select('*')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { name: string; menge: number; einheit: string }

  const { data, error } = await supabase
    .from('regelbedarf')
    .insert({ name: body.name, menge: body.menge, einheit: body.einheit })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 3: Regelbedarf-DELETE-Route anlegen**

Erstelle `app/api/einstellungen/regelbedarf/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await supabase.from('regelbedarf').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/einstellungen/route.ts app/api/einstellungen/regelbedarf/route.ts "app/api/einstellungen/regelbedarf/[id]/route.ts"
git commit -m "feat: add einstellungen and regelbedarf API routes"
```

---

### Task 6: Entscheidungsmatrix — lib/einkaufsliste.ts erweitern

**Files:**
- Modify: `lib/einkaufsliste.ts`

- [ ] **Step 1: istBringPflicht-Funktion am Anfang der Datei hinzufügen**

In `lib/einkaufsliste.ts` nach den Imports einfügen:

```typescript
import type { Gericht, WochenplanEintrag, EinkaufsItem, EinkaufslistenErgebnis, EinkaufsRouting } from '@/types'

export function istBringPflicht(zutatName: string, bringKeywords: string[]): boolean {
  const nameLower = zutatName.toLowerCase()
  return bringKeywords.some(kw => nameLower.includes(kw.toLowerCase()))
}

export function splitNachRouting(
  items: EinkaufsItem[],
  bringKeywords: string[]
): EinkaufsRouting {
  const picnic: EinkaufsItem[] = []
  const bring: EinkaufsItem[] = []

  for (const item of items) {
    if (istBringPflicht(item.name, bringKeywords)) {
      bring.push(item)
    } else {
      picnic.push(item)
    }
  }

  return { picnic, bring }
}
```

> **Wichtig:** Den bestehenden Import oben in der Datei anpassen um `EinkaufsRouting` zu ergänzen.

- [ ] **Step 2: Commit**

```bash
git add lib/einkaufsliste.ts
git commit -m "feat: add istBringPflicht and splitNachRouting to einkaufsliste"
```

---

### Task 7: /api/einkaufsliste/senden — Picnic-Orchestrierung

**Files:**
- Modify: `app/api/einkaufsliste/senden/route.ts`

- [ ] **Step 1: Route vollständig ersetzen**

`app/api/einkaufsliste/senden/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generiereEinkaufslisten, splitNachRouting } from '@/lib/einkaufsliste'
import { aktualisiereEinkaufsliste } from '@/lib/bring'
import { sucheArtikel, zumWarenkorb, warenkorbLeeren } from '@/lib/picnic'
import { ladeAktuellenWochenplan } from '@/lib/wochenplan'
import type { Gericht, EinkaufsItem, Regelbedarf } from '@/types'

async function ladePicnicEinstellungen(): Promise<{
  mindestbestellwert: number
  bringKeywords: string[]
}> {
  const { data } = await supabase
    .from('einstellungen')
    .select('key, value')
    .in('key', ['picnic_mindestbestellwert', 'picnic_bring_keywords'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return {
    mindestbestellwert: parseInt(map['picnic_mindestbestellwert'] ?? '35', 10),
    bringKeywords: JSON.parse(map['picnic_bring_keywords'] ?? '[]') as string[],
  }
}

async function ladeRegelbedarf(): Promise<Regelbedarf[]> {
  const { data } = await supabase.from('regelbedarf').select('*')
  return (data ?? []) as Regelbedarf[]
}

async function verarbeitePicnicListe(
  picnicKandidaten: EinkaufsItem[],
  mindestbestellwert: number
): Promise<{ zuPicnic: EinkaufsItem[]; zuBring: EinkaufsItem[]; gesamtpreisEuro: number }> {
  const gefunden: Array<{ item: EinkaufsItem; preisCent: number }> = []
  const nichtGefunden: EinkaufsItem[] = []

  await Promise.all(
    picnicKandidaten.map(async (item) => {
      const artikel = await sucheArtikel(item.name)
      if (artikel) {
        gefunden.push({ item, preisCent: artikel.preis })
      } else {
        nichtGefunden.push(item)
      }
    })
  )

  const gesamtpreisEuro = gefunden.reduce((sum, g) => sum + g.preisCent / 100, 0)

  if (gesamtpreisEuro < mindestbestellwert) {
    // Mindestbestellwert nicht erreicht → alles in Bring
    return {
      zuPicnic: [],
      zuBring: [...picnicKandidaten],
      gesamtpreisEuro,
    }
  }

  return {
    zuPicnic: gefunden.map(g => g.item),
    zuBring: nichtGefunden,
    gesamtpreisEuro,
  }
}

async function fuellePicnicWarenkorb(items: EinkaufsItem[]): Promise<void> {
  for (const item of items) {
    const artikel = await sucheArtikel(item.name)
    if (artikel) {
      await zumWarenkorb(artikel.artikelId, 1)
    }
  }
}

export async function POST() {
  try {
    const plan = await ladeAktuellenWochenplan()
    if (!plan) {
      return NextResponse.json(
        { error: 'Kein Wochenplan für diese Woche gefunden' },
        { status: 404 }
      )
    }

    const [{ data: gerichte }, einstellungen, regelbedarf] = await Promise.all([
      supabase.from('gerichte').select('*'),
      ladePicnicEinstellungen(),
      ladeRegelbedarf(),
    ])

    if (!gerichte) {
      return NextResponse.json({ error: 'Gerichte konnten nicht geladen werden' }, { status: 500 })
    }

    const einkaufstag2 = parseInt(process.env.EINKAUFSTAG_2 ?? '4', 10)
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(
      plan.eintraege,
      gerichte as Gericht[],
      einkaufstag2
    )

    // Routing für beide Listen
    const routing1 = splitNachRouting(einkauf1, einstellungen.bringKeywords)
    const routing2 = splitNachRouting(einkauf2, einstellungen.bringKeywords)

    // Picnic-Suche + Mindestbestellwert-Check
    const [picnic1Ergebnis, picnic2Ergebnis] = await Promise.all([
      verarbeitePicnicListe(routing1.picnic, einstellungen.mindestbestellwert),
      verarbeitePicnicListe(routing2.picnic, einstellungen.mindestbestellwert),
    ])

    // Bring-Listen zusammenstellen
    const bring1Gesamt = [
      ...routing1.bring,
      ...picnic1Ergebnis.zuBring,
    ]
    const bring2Gesamt = [
      ...routing2.bring,
      ...picnic2Ergebnis.zuBring,
    ]

    // Regelbedarf als EinkaufsItem für Picnic aufbereiten
    const regelbedarfItems: EinkaufsItem[] = regelbedarf.map(r => ({
      name: r.name,
      menge: r.menge,
      einheit: r.einheit,
    }))

    // Picnic-Warenkorb leeren und neu befüllen
    await warenkorbLeeren()
    await fuellePicnicWarenkorb([
      ...picnic1Ergebnis.zuPicnic,
      ...regelbedarfItems,        // Regelbedarf immer in Einkauf 1
      ...picnic2Ergebnis.zuPicnic,
    ])

    // Bring-Listen senden (bestehende Logik)
    const listName1 = process.env.BRING_LIST_NAME_1 ?? 'Jarvis — Einkauf 1'
    const listName2 = process.env.BRING_LIST_NAME_2 ?? 'Jarvis — Einkauf 2'

    await Promise.all([
      aktualisiereEinkaufsliste(listName1, bring1Gesamt),
      aktualisiereEinkaufsliste(listName2, bring2Gesamt),
    ])

    return NextResponse.json({
      einkauf1Count: bring1Gesamt.length,
      einkauf2Count: bring2Gesamt.length,
      picnic1Count: picnic1Ergebnis.zuPicnic.length + regelbedarfItems.length,
      picnic2Count: picnic2Ergebnis.zuPicnic.length,
      picnic1Fallback: picnic1Ergebnis.zuPicnic.length === 0 && routing1.picnic.length > 0,
      picnic2Fallback: picnic2Ergebnis.zuPicnic.length === 0 && routing2.picnic.length > 0,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unbekannter Fehler' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Wochenplan-Seite Meldung aktualisieren**

In `app/wochenplan/page.tsx` die Erfolgs-Meldung nach dem Einkauf-Senden erweitern um Picnic-Statistik. Die bestehende Zeile:

```typescript
setEinkaufMeldung(
  `✅ Einkauf 1 (${data.einkauf1Count} Artikel) und Einkauf 2 (${data.einkauf2Count} Artikel) wurden in Bring aktualisiert`
)
```

Ersetzen durch:

```typescript
const picnicInfo = data.picnic1Count > 0 || data.picnic2Count > 0
  ? ` | Picnic: ${data.picnic1Count + data.picnic2Count} Artikel`
  : ''
const fallbackInfo = data.picnic1Fallback || data.picnic2Fallback
  ? ' (Mindestbestellwert nicht erreicht → Bring)'
  : ''
setEinkaufMeldung(
  `✅ Bring: ${data.einkauf1Count + data.einkauf2Count} Artikel${picnicInfo}${fallbackInfo}`
)
```

- [ ] **Step 3: Commit**

```bash
git add app/api/einkaufsliste/senden/route.ts app/wochenplan/page.tsx
git commit -m "feat: orchestrate picnic + bring in einkaufsliste/senden route"
```

---

### Task 8: /einstellungen Seite

**Files:**
- Create: `app/einstellungen/page.tsx`

- [ ] **Step 1: Einstellungen-Seite anlegen**

Erstelle `app/einstellungen/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { Regelbedarf } from '@/types'

export default function EinstellungenPage() {
  const [regelbedarf, setRegelbedarf] = useState<Regelbedarf[]>([])
  const [neuerName, setNeuerName] = useState('')
  const [neueMenge, setNeueMenge] = useState('')
  const [neueEinheit, setNeueEinheit] = useState('Packung')
  const [mindestbestellwert, setMindestbestellwert] = useState('35')
  const [bringKeywords, setBringKeywords] = useState<string[]>([])
  const [neuesKeyword, setNeuesKeyword] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [speichere, setSpeichere] = useState(false)

  useEffect(() => {
    fetch('/api/einstellungen/regelbedarf').then(r => r.json()).then(setRegelbedarf)
    fetch('/api/einstellungen').then(r => r.json()).then((data: Record<string, string>) => {
      setMindestbestellwert(data['picnic_mindestbestellwert'] ?? '35')
      try {
        setBringKeywords(JSON.parse(data['picnic_bring_keywords'] ?? '[]'))
      } catch {
        setBringKeywords([])
      }
    })
  }, [])

  async function regelbedarfHinzufuegen() {
    if (!neuerName || !neueMenge) return
    const res = await fetch('/api/einstellungen/regelbedarf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: neuerName, menge: parseFloat(neueMenge), einheit: neueEinheit }),
    })
    if (res.ok) {
      setRegelbedarf(await fetch('/api/einstellungen/regelbedarf').then(r => r.json()))
      setNeuerName('')
      setNeueMenge('')
    }
  }

  async function regelbedarfLoeschen(id: string) {
    await fetch(`/api/einstellungen/regelbedarf/${id}`, { method: 'DELETE' })
    setRegelbedarf(prev => prev.filter(r => r.id !== id))
  }

  async function picnicEinstellungenSpeichern() {
    setSpeichere(true)
    try {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picnic_mindestbestellwert: mindestbestellwert,
          picnic_bring_keywords: JSON.stringify(bringKeywords),
        }),
      })
      setMeldung('✅ Einstellungen gespeichert')
    } catch {
      setMeldung('❌ Fehler beim Speichern')
    } finally {
      setSpeichere(false)
    }
  }

  function keywordHinzufuegen() {
    if (!neuesKeyword || bringKeywords.includes(neuesKeyword)) return
    setBringKeywords(prev => [...prev, neuesKeyword])
    setNeuesKeyword('')
  }

  function keywordEntfernen(kw: string) {
    setBringKeywords(prev => prev.filter(k => k !== kw))
  }

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <a
          href="/wochenplan"
          className="text-gray-600 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Wochenplan
        </a>
      </div>

      {meldung && (
        <p className="text-sm mb-4 p-3 bg-gray-50 rounded-lg">{meldung}</p>
      )}

      {/* Regelbedarf */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Regelbedarf (Picnic)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Diese Artikel werden bei jeder Einkaufsliste automatisch zu Picnic hinzugefügt.
        </p>
        <div className="space-y-2 mb-4">
          {regelbedarf.map(r => (
            <div key={r.id} className="flex justify-between items-center border border-gray-200 rounded-lg p-3">
              <span className="text-sm text-gray-800">
                {r.menge} {r.einheit} {r.name}
              </span>
              <button
                onClick={() => regelbedarfLoeschen(r.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={neuerName}
            onChange={e => setNeuerName(e.target.value)}
            placeholder="Artikel (z.B. Toast)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <input
            value={neueMenge}
            onChange={e => setNeueMenge(e.target.value)}
            placeholder="Menge"
            type="number"
            className="w-20 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <select
            value={neueEinheit}
            onChange={e => setNeueEinheit(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            {['Packung', 'Stück', 'l', 'g', 'kg'].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <button
            onClick={regelbedarfHinzufuegen}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Hinzufügen
          </button>
        </div>
      </section>

      {/* Picnic Mindestbestellwert */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Picnic Mindestbestellwert
        </h2>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            value={mindestbestellwert}
            onChange={e => setMindestbestellwert(e.target.value)}
            className="w-24 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <span className="text-sm text-gray-600">€</span>
        </div>
      </section>

      {/* Bring-Kategorien */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Bring-Kategorien (immer persönlich einkaufen)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Zutaten deren Name eines dieser Stichworte enthält gehen immer nach Bring.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {bringKeywords.map(kw => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-sm rounded-full px-3 py-1"
            >
              {kw}
              <button
                onClick={() => keywordEntfernen(kw)}
                className="text-orange-500 hover:text-orange-800 ml-1"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={neuesKeyword}
            onChange={e => setNeuesKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && keywordHinzufuegen()}
            placeholder="Neues Stichwort (z.B. Lachs)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={keywordHinzufuegen}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            + Hinzufügen
          </button>
        </div>
      </section>

      <button
        onClick={picnicEinstellungenSpeichern}
        disabled={speichere}
        className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
      >
        {speichere ? 'Speichere...' : 'Alle Einstellungen speichern'}
      </button>
    </main>
  )
}
```

- [ ] **Step 2: Link zur Einstellungen-Seite in Wochenplan-Navigation ergänzen**

In `app/wochenplan/page.tsx` in der Navigation einen Link zur Einstellungen-Seite hinzufügen. Den bestehenden "Gerichte" Link suchen und daneben einen "Einstellungen" Link ergänzen:

```tsx
<a
  href="/einstellungen"
  className="text-gray-600 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
>
  Einstellungen
</a>
```

- [ ] **Step 3: Commit**

```bash
git add app/einstellungen/page.tsx app/wochenplan/page.tsx
git commit -m "feat: add einstellungen page with regelbedarf, mindestbestellwert and bring-keywords"
```
