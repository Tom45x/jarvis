# Jarvis Plan 2a — Bring API Integration: Design Spec

**Datum:** 2026-04-14  
**Status:** Genehmigt

---

## Ziel

Jarvis generiert automatisch eine strukturierte Einkaufsliste aus dem aktuellen Wochenplan und überträgt sie in zwei Bring-Listen — aufgeteilt nach Einkaufstagen und Haltbarkeit der Zutaten.

---

## Datenmodell

### `gerichte.zutaten` (DB-Migration)

Die bestehende Spalte `zutaten text[]` wird zu `zutaten jsonb` migriert.

**Format pro Gericht:**
```json
[
  { "name": "Hackfleisch", "menge": 500, "einheit": "g", "haltbarkeit_tage": 2 },
  { "name": "Nudeln", "menge": 400, "einheit": "g", "haltbarkeit_tage": 365 },
  { "name": "Zwiebeln", "menge": 2, "einheit": "Stück", "haltbarkeit_tage": 14 }
]
```

Alle Mengen beziehen sich auf **4 Personen, 1 Mahlzeit**.

### Bring-Credentials (`.env.local`)

```
BRING_EMAIL=...
BRING_PASSWORD=...
BRING_EINKAUF1_LIST_ID=...   # UUID der Bring-Liste "Jarvis — Einkauf 1"
BRING_EINKAUF2_LIST_ID=...   # UUID der Bring-Liste "Jarvis — Einkauf 2"
```

### Einstellungen in Supabase

Neue Tabelle `einstellungen` (Key-Value):

| key | value | Beispiel |
|-----|-------|---------|
| `einkaufstag_1` | Wochentag (0=So, 1=Mo…) | `1` (Montag) |
| `einkaufstag_2` | Wochentag | `4` (Donnerstag) |

---

## Komponenten

### 1. Zutaten-Generierung (einmalig + bei Bedarf)

**Neue Seite:** `app/gerichte/page.tsx`

- Zeigt alle Gerichte in einer Tabelle mit ihren Zutaten
- Button **"Zutaten automatisch generieren"**: 1 Claude API-Call mit allen Gerichtenamen → strukturierte Zutaten für alle Gerichte gleichzeitig
- Pro Gericht: Inline-Bearbeitung der Zutaten (hinzufügen, ändern, löschen)
- Button **"Speichern"**: schreibt alle Änderungen in Supabase
- Einzelne Gerichte können nachträglich neu generiert werden (z.B. bei neuen Gerichten)

**API-Route:** `app/api/zutaten/generieren/route.ts`  
Claude-Prompt gibt strukturiertes JSON zurück mit Zutaten für alle Gerichte auf einmal.

### 2. Einkaufsliste-Generierung (`lib/einkaufsliste.ts`)

**Eingabe:** Wochenplan-Einträge + Gerichte mit Zutaten + Einkaufstage (aus Einstellungen)

**Algorithmus:**

1. "(Reste)"-Einträge aus dem Plan **überspringen** — sie brauchen keine eigene Einkaufsmenge
2. Für Gerichte die im Plan 2× vorkommen (Basis + Reste): Zutaten-Menge **verdoppeln**
3. Pro Zutat und Gericht: bestimme **welcher Einkauf** nötig ist:
   - `haltbarkeit_tage >= 5` → immer Einkauf 1
   - `haltbarkeit_tage < 5` UND Gericht ist Mo–Einkaufstag2: → Einkauf 1
   - `haltbarkeit_tage < 5` UND Gericht ist ab Einkaufstag2: → Einkauf 2
4. Innerhalb jeder Liste: gleiche Zutaten mit gleicher Einheit zusammenfassen
5. **Kein Aggregieren über Listen-Grenzen** — Hackfleisch kann in beiden Listen stehen

**Ausgabe:** `{ einkauf1: EinkaufsItem[], einkauf2: EinkaufsItem[] }`

```ts
interface EinkaufsItem {
  name: string
  menge: number
  einheit: string
}
```

### 3. Bring-API-Integration (`lib/bring.ts`)

- Authentifizierung mit Email/Passwort aus `.env`
- `aktualisiereEinkaufsliste(listId, items)`: Liste komplett leeren + neu befüllen
- Verwendet die Community-Bibliothek `bring-shopping` (npm)

**API-Route:** `app/api/einkaufsliste/senden/route.ts`
- Generiert beide Listen
- Schreibt beide Listen nach Bring
- Gibt Zusammenfassung zurück: `{ einkauf1Count, einkauf2Count }`

### 4. UI auf der Wochenplan-Seite

Neuer Button unter dem Wochenplan:

```
[📋 Einkaufslisten in Bring übertragen]
```

Nach Klick: kurze Ladeanimation, dann Bestätigung:

> ✅ Einkauf 1 (23 Artikel, Mo) und Einkauf 2 (11 Artikel, Do) wurden in Bring aktualisiert.

---

## Randfälle & Fixes

| Problem | Lösung |
|---------|--------|
| Gleiche Zutat in beiden Wochen-Hälften | Erscheint in **beiden** Listen separat (kein Liste-übergreifendes Aggregieren) |
| Reste-Gerichte | Plan-Eintrag mit "(Reste)" wird übersprungen; Basis-Gericht bekommt doppelte Menge |
| Gericht ohne Zutaten (noch nicht generiert) | Warnung in der UI: "X Gerichte haben noch keine Zutaten" |
| Kein Wochenplan vorhanden | Button deaktiviert mit Hinweis |
| Bring API nicht erreichbar | Fehlermeldung in der UI |

---

## Dateistruktur

```
app/
  gerichte/
    page.tsx                          NEU — Zutaten-Verwaltung
  api/
    zutaten/
      generieren/
        route.ts                      NEU — Claude generiert Zutaten
    einkaufsliste/
      senden/
        route.ts                      NEU — Einkaufsliste → Bring
lib/
  bring.ts                            NEU — Bring API wrapper
  einkaufsliste.ts                    NEU — Splitting-Logik
supabase/
  migration_zutaten_jsonb.sql         NEU — text[] → jsonb
  migration_einstellungen.sql         NEU — Einstellungen-Tabelle
```

---

## Nicht im Scope (Plan 2a)

- Picnic-Integration (→ Plan 2b)
- Manuelle Einkaufsartikel die nicht aus dem Wochenplan kommen
- Push-Benachrichtigungen an Bens/Maries Geräte
- Mehrere Wochenpläne gleichzeitig
