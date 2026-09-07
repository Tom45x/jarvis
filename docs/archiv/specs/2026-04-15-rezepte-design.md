# Rezepte-Feature — Design Spec
Datum: 2026-04-15

## Ziel

Jedes Gericht bekommt ein vollständiges Rezept (Zutatenliste + Zubereitungsschritte). Claude generiert diese automatisch. Rezepte sind auf der Gerichte-Seite bearbeitbar und im Wochenplan über ein Bottom Sheet abrufbar.

---

## Datenmodell

### Erweiterung: `Gericht.rezept`

```typescript
// types/index.ts
rezept?: {
  zutaten: string[]       // lesbare Strings: "200g Nudeln", "2 Eier"
  zubereitung: string[]   // ["Wasser kochen", "Nudeln al dente garen", ...]
}
```

**Abgrenzung:** `rezept.zutaten` (lesbare Strings fürs Kochen) ist bewusst getrennt von `Gericht.zutaten` (strukturierte `Zutat[]`-Objekte für die Einkaufsliste). Beide Felder existieren parallel.

**DB-Migration (einmalig in Supabase):**
```sql
ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS rezept JSONB DEFAULT NULL;
```

---

## API

### `POST /api/rezepte/generieren`

Generiert Rezepte via Claude und schreibt sie in die DB.

**Body:**
```json
{ "gerichtId": "uuid" }   // optional — ohne ID: alle Gerichte ohne Rezept
```

**Verhalten:**
- Mit `gerichtId`: genau dieses Gericht aktualisieren
- Ohne `gerichtId`: alle Gerichte, bei denen `rezept IS NULL`, in einem einzigen Claude-Call
- Claude liefert je Gericht: `zutaten: string[]` (4–8 Einträge) + `zubereitung: string[]` (4–6 Schritte)
- Prompt-Format identisch zu `/api/zutaten/generieren`
- Response: `{ aktualisiert: number }`

---

## Gerichte-Seite

### Rezept anzeigen & bearbeiten

In der aufgeklappten Karte erscheint nach dem Zutaten-Abschnitt ein neuer **"Zubereitung"**-Bereich:

- Zubereitungsschritte als nummerierte Liste
- Im Bearbeitungsmodus: Textarea pro Schritt (inline editierbar)
- Button "+ Schritt" zum Hinzufügen, "×" zum Entfernen
- Speichern über bestehenden "Speichern"-Button (der auch Zutaten speichert)
- Einzelner "Rezept generieren"-Button pro Karte (ruft `/api/rezepte/generieren` mit `gerichtId` auf)

**Header-Button:** Bestehender "✨ Zutaten"-Button wird zu "✨ Alles generieren" — generiert sowohl Zutaten als auch Rezepte für alle Gerichte ohne diese Daten.

---

## Wochenplan — Bottom Sheet

### GerichtCard

Kleiner "Rezept"-Link ganz unten auf der Karte, klar getrennt vom Tausch-Button:

```
[Gerichtsname]
[Mittag · 🌿]
                              [↻ Tauschen]
─────────────────────────────────────────
Rezept →
```

Nur sichtbar, wenn `gericht.rezept` vorhanden ist.

### RezeptSheet-Komponente

Neue Komponente `components/RezeptSheet.tsx`:

- Rendert als fixed-positioned Overlay mit dunklem Hintergrund
- Panel fährt von unten ein (CSS `transform: translateY`, Transition)
- Schließen: Tap auf Hintergrund oder Swipe-down-Geste
- Inhalt: Gerichtsname (H2), Zutaten-Liste, Zubereitungsschritte (nummeriert)
- Max-Höhe: 80vh, scrollbar

**State im Wochenplan:**
```typescript
const [rezeptGericht, setRezeptGericht] = useState<Gericht | null>(null)
```
`RezeptSheet` wird conditional gerendert wenn `rezeptGericht !== null`.

---

## Fehlerbehandlung

- Gericht hat kein Rezept → "Rezept"-Link nicht anzeigen (nicht disabled, einfach weg)
- Claude-Generierung schlägt fehl → Fehlermeldung im bestehenden `meldung`-State
- JSON.parse-Fehler → 502 mit Fehlermeldung (bereits durch K3-Fix abgedeckt)

---

## Nicht im Scope

- Rezepte für Bestellgerichte ("Essen wird bestellt") — kein Rezept nötig
- Rezept-Versionierung oder Historie
- Fotos / Medien
- Portionsrechner
