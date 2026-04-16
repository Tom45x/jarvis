# Gericht hinzufügen — Design

**Goal:** Katja kann auf der Gerichte-Seite manuell ein neues Gericht anlegen — entweder mit KI-generiertem Rezept & Zutaten oder vollständig manuell.

**Architecture:** Nur `app/gerichte/page.tsx` wird geändert. Alle benötigten API-Endpunkte existieren bereits. Kein neuer State außerhalb der Seite, keine neuen Komponenten.

**Tech Stack:** Next.js App Router, React useState, bestehende `apiFetch`-Abstraktion, Supabase via bestehende API-Routes.

---

## UI-Einstiegspunkt

Direkt unterhalb der "Neue Gerichte entdecken"-Fläche und oberhalb des Kategorie-Filters erscheint ein neuer Button:

```
[＋ Neues Gericht hinzufügen]    (volle Breite, background: var(--surface))
```

Bei Klick klappt das Formular inline darunter auf (kein Sheet, kein Navigation-Wechsel).

---

## Formular-Struktur

### Immer sichtbar

- **Namensfeld** — `<input type="text">` mit Placeholder "Name des Gerichts", volle Breite, gleicher Style wie bestehende Inputs auf der Seite (`border: 1.5px solid var(--border)`, `fontSize: 16px`, `minHeight: 48px`)
- **Zwei Auswahl-Buttons** nebeneinander (je 50% Breite):
  - `✨ Generieren` — wählt den KI-Pfad
  - `✍️ Manuell` — wählt den manuellen Pfad
  - Aktiver Button: `background: var(--near-black), color: #ffffff`
  - Inaktiver Button: `background: var(--surface), color: var(--near-black)`

### Generieren-Pfad

Wenn "Generieren" gewählt und Name ausgefüllt:
- Button `✨ Zutaten & Rezept generieren` (volle Breite, `background: var(--rausch)`) wird aktiv
- Klick startet die Sequenz:
  1. `POST /api/gerichte` mit `{ name, kategorie: 'sonstiges', aufwand: '30 Min', quelle: 'manuell', gesund: false }`
  2. `POST /api/zutaten/generieren` mit `{ gerichtId }`
  3. `POST /api/rezepte/generieren` mit `{ gerichtId }`
- Loading-State: Button zeigt Spinner / "..."
- Danach: Formular schließt sich, Liste lädt neu, Meldung `✅ [Name] hinzugefügt`
- Kategorie und Aufwand können nachträglich über den bestehenden Bearbeiten-Button angepasst werden

### Manuell-Pfad

Wenn "Manuell" gewählt, erscheinen zusätzlich:
- **Kategorie** — `<select>` mit allen gültigen Kategorien (`fleisch`, `nudeln`, `suppe`, `auflauf`, `fisch`, `salat`, `sonstiges`, `kinder`, `trainingstage`, `frühstück`, `filmabend`), Default: `sonstiges`
- **Aufwand** — `<select>` mit `15 Min`, `30 Min`, `45 Min`, `60+ Min`, Default: `30 Min`
- **Toggle** `＋ Zutaten & Rezept jetzt hinzufügen` (gestrichelter Button, identisch zum bestehenden `+ Zutat`-Pattern) — optional, klappt den Zutaten-Editor auf
- Wenn Toggle aktiv: Zutaten-Editor erscheint inline — identisch zum bestehenden Bearbeiten-Modus (Name/Menge/Einheit pro Zeile + `+ Zutat`-Button)
- **Aktions-Buttons**: `[Speichern]` (primary) + `[Abbrechen]` (secondary)
  - Speichern funktioniert mit oder ohne Zutaten
  - Klick: `POST /api/gerichte` mit allen Feldern; wenn Zutaten vorhanden: `PATCH /api/gerichte/:id` mit `{ zutaten }`
  - Danach: Formular schließt sich, Liste lädt neu, Meldung `✅ [Name] hinzugefügt`

---

## State in page.tsx

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

Beim Schließen/Abbrechen: alle neues-Gericht-States auf Initialwerte zurücksetzen.

---

## Validierung

- Speichern / Generieren ist nur aktiv wenn `neuesGerichtName.trim()` nicht leer
- Bei `POST /api/gerichte` liefert die API bereits Fehlermeldungen zurück — diese werden in der bestehenden `meldung`-State-Variable angezeigt

---

## Nicht im Scope

- Duplikat-Erkennung (gleicher Name bereits vorhanden)
- Rezept-Generierung im manuellen Pfad (Rezept kann später über den Bearbeiten-Button generiert werden)
- Bewertung / gesund-Flag beim Anlegen (Defaults: `bewertung: 3`, `gesund: false`)
