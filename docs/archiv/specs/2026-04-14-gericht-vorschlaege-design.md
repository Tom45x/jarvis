# Gericht-Vorschläge — Design Spec

**Datum:** 2026-04-14
**Status:** Approved

## Ziel

Claude schlägt auf Anfrage 3 neue Gerichte vor, die zur Familie passen und noch nicht in der DB sind. Jeder Vorschlag wird mit einem TheMealDB-Rezeptlink angereichert. Der Nutzer entscheidet, welche Gerichte in die DB aufgenommen werden — bei Aufnahme werden automatisch Zutaten generiert.

---

## UI (Gerichte-Seite)

Neuer Abschnitt "Neue Gerichte entdecken" unterhalb der bestehenden Gerichte-Liste:

- Optionales Textfeld: *"Worauf habt ihr Lust? (optional)"* — z.B. "mehr Fisch" oder "etwas für den Sommer"
- Button **"3 Vorschläge generieren"** → ruft API auf, zeigt Ladeindikator
- Ergebnis: 3 Karten, je mit:
  - Gerichtname
  - Kurze Beschreibung (1-2 Sätze)
  - Kategorie + Aufwand
  - Link "Rezept ansehen" → TheMealDB (falls Match gefunden, sonst kein Link)
  - Button **Hinzufügen** | Button **Überspringen**

---

## API: `POST /api/gerichte/vorschlaege`

**Input:**
```json
{
  "hinweis": "mehr Fischgerichte" // optional, kann leer sein
}
```

**Server-seitig:**
1. Lädt alle bestehenden Gerichtenamen aus Supabase
2. Lädt Familienprofile aus Supabase
3. Sendet Prompt an Claude mit: bestehenden Gerichten (zur Duplikat-Vermeidung), Familienprofilen, optionalem Hinweis
4. Claude gibt 3 Vorschläge zurück: `{name, kategorie, aufwand, beschreibung}`
5. Für jeden Vorschlag: TheMealDB-Suche via `lib/themealdb.ts`
6. Gibt angereicherte Vorschläge zurück

**Claude-Prompt-Anforderungen:**
- Keine Gerichte vorschlagen die bereits in der bestehenden Liste sind
- Gerichte zur Familie passend (Kinder-freundlich, Abneigungen berücksichtigen)
- Optionalen Hinweis priorisieren
- Antwortet als JSON-Array mit 3 Objekten

**Output:**
```json
[
  {
    "name": "Lachs mit Spinat",
    "kategorie": "fisch",
    "aufwand": "mittel",
    "beschreibung": "Gebratener Lachs auf frischem Blattspinat...",
    "rezept_url": "https://www.themealdb.com/meal/12345" // oder null
  }
]
```

---

## lib/themealdb.ts

Schlanker Wrapper um die TheMealDB Such-API:

```typescript
// Sucht ein Gericht nach Name, gibt URL zurück oder null
export async function sucheRezeptUrl(name: string): Promise<string | null>
```

Intern: `GET https://www.themealdb.com/api/json/v1/1/search.php?s=NAME`
- Bei Match: `https://www.themealdb.com/meal/{idMeal}`
- Bei keinem Match oder Fehler: `null` (kein hartes Scheitern)

---

## "Hinzufügen"-Flow

Wenn der Nutzer auf **Hinzufügen** klickt:

1. `POST /api/gerichte` — legt neues Gericht an:
   ```json
   {
     "name": "...",
     "kategorie": "...",
     "aufwand": "...",
     "gesund": false,
     "quelle": "themealdb",
     "zutaten": [],
     "tausch_count": 0,
     "gesperrt": false
   }
   ```
2. Danach: bestehenden Zutaten-Generierungs-Flow triggern (Claude generiert Zutaten für das neue Gericht)
3. Karte verschwindet aus der Vorschlagsliste

---

## Nicht im Scope

- Kein automatischer wöchentlicher Trigger — immer on-demand
- Kein Speichern von abgelehnten Vorschlägen
- Keine Pagination (immer genau 3 Vorschläge)
