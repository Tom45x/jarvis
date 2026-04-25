# Spec: Instagram-Rezept-Import

**Datum:** 2026-04-25
**Status:** ✅ Implementiert und live (2026-04-26)

---

## Überblick

Katja teilt Reels von Koch-Creators (z.B. `joeskochwelt`) direkt aus der Instagram-App an Jarvis. Server scraped die Caption, Claude parsed sie in ein strukturiertes Gericht (Name, Zutaten, Rezept, Aufwand, Gesund-Flag), schreibt es in die `gerichte`-Tabelle und meldet Erfolg via iOS-Notification zurück. Kein App-Wechsel, kein Review-Screen — Katja teilt nur Reels, die sie tatsächlich behalten will.

**Use-Case-Abgrenzung:** Diese Spec deckt **nur ad-hoc-Sharing einzelner öffentlicher Reels**. Bulk-Import von Saved Posts aus Katjas Account (private) ist Phase 2 und nicht Teil dieser Spec.

**Plattform:** iPhone 13/14 (Katjas Gerät). Web Share Target API wird von iOS Safari nicht unterstützt — Trigger ist daher ein iOS-Kurzbefehl (Shortcut).

---

## Datenfluss

```
[Insta-App auf iPhone]
    │
    │ "Teilen" → "An Jarvis senden" (iOS-Shortcut)
    ▼
[Shortcut führt POST aus]
    │ POST https://jarvis.app/api/instagram/import
    │ Body: { url, token }
    ▼
[Server: /api/instagram/import]
  1. Token-Check
  2. URL-Validierung (instagram.com/reel/* | /p/*)
  3. URL normalisieren (Query-Params abschneiden)
  4. Dedup-Check via quelle_url
  5. Insta-Page mit Mobile-UA fetchen → og:description extrahieren
  6. HTML-Entities dekodieren
  7. Claude-Call: Caption → strukturiertes Gericht
  8. INSERT in gerichte (kategorie='instagram', quelle='instagram', quelle_url=<url>)
  9. Return { ok: true, gericht_name, existing }
    │
    ▼
[Shortcut zeigt Notification]
   ✓ Importiert: Ofen Feta Hähnchen Pasta
   (oder bei Fehler: ⚠️ <Fehlermeldung>)
```

**Wichtig:** Der Endpoint returnt **immer HTTP 200** — auch bei Fehlern. Body trägt das Ergebnis in `ok: boolean`. Grund: iOS-Shortcuts brechen bei non-2xx Codes ab und können dann den Fehlertext nicht mehr aus dem Response-Body lesen.

---

## Datenmodell

### Migration

```sql
-- Eine neue Spalte: Original-URL des Insta-Reels (Dedup-Key)
ALTER TABLE gerichte
  ADD COLUMN quelle_url TEXT;

-- Partial Unique-Index: Dedup greift nur, wenn URL gesetzt ist.
-- Bestehende Gerichte (alle quelle_url=NULL) kollidieren nicht.
CREATE UNIQUE INDEX gerichte_quelle_url_unique
  ON gerichte (quelle_url)
  WHERE quelle_url IS NOT NULL;
```

### TypeScript-Typen (`app/types/index.ts`)

```ts
export type Kategorie =
  | 'fleisch' | 'nudeln' | 'suppe' | 'auflauf' | 'fisch' | 'salat'
  | 'sonstiges' | 'kinder' | 'trainingstage' | 'frühstück' | 'filmabend'
  | 'gesundheitssnack' | 'saft'
  | 'instagram'                          // ← neu

export interface Gericht {
  // ... bestehend
  quelle: 'manuell' | 'themealdb' | 'ki-vorschlag' | 'instagram'  // ← + 'instagram'
  quelle_url?: string                    // ← neu, optional
}
```

### Konstanten anpassen

- `app/app/api/gerichte/route.ts` → `GUELTIGE_KATEGORIEN` Array um `'instagram'` erweitern.

### Bewusst NICHT geändert

- `aufwand` und `gesund` schätzt Claude beim Import — kein DB-Default-Override nötig.
- `bewertung` bleibt Default `3`.
- Keine neue Tabelle, kein `creator`-Feld (YAGNI).

### Auswirkung auf Wochenplan-Auto-Generator

Insta-Importe haben Kategorie `'instagram'`, die in keiner Wochenplan-Slot-Logik (Mittag-Kategorien, Abend-Kategorien, Filmabend etc.) vorkommt. **Dadurch sind sie aus der automatischen Wochenplan-Generierung ausgeschlossen** und können nur per manuellem Tausch in den Plan kommen. Das ist gewollt — Katja kuratiert, ob ein importiertes Gericht reif für die Rotation ist.

---

## Endpoint-Spezifikation

**Route:** `POST /api/instagram/import`
**Datei:** `app/app/api/instagram/import/route.ts`

### Request-Body

```ts
{ url: string, token: string }
```

### Response (immer HTTP 200)

**Erfolg:**
```ts
{ ok: true, existing: false, gericht_id: string, gericht_name: string, display: string }
```

**Erfolg (bereits importiert):**
```ts
{ ok: true, existing: true, gericht_id: string, gericht_name: string, display: string }
```

**Fehler:**
```ts
{ ok: false, error: string, display: string }
```

**Das `display`-Feld** — wird vom Server für die iOS-Mitteilung vorgerendert, der Shortcut zeigt es 1:1 an:
- Erfolg: `✓ <gericht_name>`
- Bereits importiert: `↻ <gericht_name> (schon importiert)`
- Fehler: `⚠️ <error>`

### Validierungs-Pipeline

1. **Token-Check** — **timing-safe** via `crypto.timingSafeEqual` gegen `process.env.INSTA_IMPORT_TOKEN` → sonst `{ ok: false, error: "Ungültiger Token" }`
2. **URL-Pattern** — Regex `^https://(www\.)?instagram\.com/(reel|p)/[A-Za-z0-9_-]+/?` → sonst `{ ok: false, error: "Keine gültige Instagram-URL" }`
3. **URL normalisieren** — Query-Params (`?igsh=...`, `?utm_source=...`) abschneiden → reine `https://www.instagram.com/reel/<id>/` als Dedup-Key
4. **Dedup-Check** — `SELECT id, name FROM gerichte WHERE quelle_url = ?` → wenn vorhanden: `{ ok: true, existing: true, ... }`
5. **Insta-Scrape** — `fetch(url, { headers: { 'User-Agent': IPHONE_UA }})` mit Timeout 10s
   - `IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'` (verifiziert mit Test-Reel — Mobile-UA ist Voraussetzung dafür, dass Insta `og:description` mit voller Caption ausspielt)
   - Regex `<meta property="og:description" content="([^"]*)"` auf HTML
   - Wenn nichts → `{ ok: false, error: "Konnte das Reel nicht öffnen — vielleicht privat oder gelöscht?" }`
6. **HTML-Entities dekodieren** — `&#xe4;` → `ä`, `&#x2733;` → `✳`, etc.
7. **Claude-Call** — siehe Abschnitt "Claude-Prompt"
   - Bei Parse-Fail oder leerem Output → `{ ok: false, error: "Rezept konnte nicht extrahiert werden" }`
8. **Insert** — `INSERT INTO gerichte (...) RETURNING id, name`
   - **Race-Condition-Schutz**: bei Postgres-Fehler `23505` (Unique-Constraint-Violation auf `quelle_url`) → das parallel angelegte Gericht via Re-Select holen und mit `existing: true` zurückgeben (statt Fehler).
9. **Return** — `{ ok: true, existing: false, gericht_id, gericht_name }`

**Außerdem:** Die ganze POST-Funktion ist in einem **outer try/catch** verpackt. Unerwartete Fehler (DB-Outage, Anthropic-Throw, Netzwerk-Hiccup) liefern `{ ok: false, error: "Interner Fehler" }` mit HTTP 200 — niemals 5xx. Das Always-200-Versprechen ist damit selbst bei Crashes garantiert.

### Helper-Module

**`lib/instagram.ts`:**
- `normalisiereInstaUrl(url: string): string` — strippt Query-Params, normalisiert auf kanonische Form
- `holeReelCaption(url: string): Promise<{ caption: string } | null>` — fetcht Page mit Mobile-UA, extrahiert og:description, dekodiert Entities

**`lib/instagram-parser.ts`:**
- `parseRezeptMitClaude(caption: string): Promise<ParsedGericht | null>` — Claude-Call, JSON-Parse, Validierung
- Loggt in `claude_nutzung`-Tabelle als `feature='instagram-import'`

### Logging

Bei jedem Fehler im Pfad: URL + **gekürzte Caption** (auf 500 Zeichen) ins Server-Log via `console.error`. Kürzung ist DSGVO-Schutz (Captions können personenbezogene Inhalte enthalten) und vermeidet Log-Spam bei sehr langen Captions.

### Rate-Limiting

Bewusst keins. Der Token-Schutz reicht im Familienkontext. Wenn Insta uns aus IP-Spam-Gründen blockt, fixen wir das mit Rate-Limit-Logic später.

---

## Claude-Prompt

**Model:** `claude-sonnet-4-6`
**max_tokens:** 4096
**Tracking:** in `claude_nutzung` als `feature='instagram-import'`

### System-Prompt

```
Du bekommst eine Instagram-Reel-Caption auf Deutsch. Extrahiere daraus ein
strukturiertes Gericht für die Familienküche.

Output: AUSSCHLIESSLICH dieses JSON, kein weiterer Text:

{
  "name": "<kurzer Gericht-Name, max 50 Zeichen, ohne Emojis>",
  "aufwand": "15 Min" | "30 Min" | "45 Min" | "60+ Min",
  "gesund": true | false,
  "zutaten": [
    { "name": "<Lebensmittel>", "menge": <Zahl>, "einheit": "<...>", "haltbarkeit_tage": <Zahl> }
  ],
  "rezept": {
    "zutaten": ["<lesbare Strings, Original-Formulierung>"],
    "zubereitung": ["<Schritt 1>", "<Schritt 2>", ...]
  }
}

REGELN:

1. NAME — Aus Titel/Caption ableiten, ABER Creator-Prefixes wie
   "Kochen & Backen mit • Josef •" oder "@joeskochwelt:" weglassen.

2. STRUKTURIERTE ZUTATEN (zutaten[], speist Einkaufsliste):
   - Markennamen: Wenn du sicher weißt, was das generische Lebensmittel ist,
     ersetze es (z.B. "Maggi Würzbrühe" → "Gemüsebrühe"). Bei Unsicherheit:
     Zutat KOMPLETT WEGLASSEN aus diesem Array.
   - Mengen wie "eine Handvoll" oder "etwas" sinnvoll schätzen
     (Handvoll Bärlauch = 1 Bund, "etwas Salz" = 1 TL).
   - Einheit-Whitelist: g, ml, Stück, EL, TL, Bund, Packung, kg, l.
   - haltbarkeit_tage: Frisches Gemüse/Kräuter 3–5, Hähnchen/Fisch 2,
     Käse/Wurst 14, Eier 21, Konserven 365, Pasta/Reis 730.

3. REZEPT.ZUTATEN (lesbar, Mensch):
   - Original-Reihenfolge und -Formulierung bewahren ("2 Hähnchenbrüste").
   - Markennamen HIER bleiben drin (auch wenn aus zutaten[] entfernt).
   - Emojis (✳️ 🍗 etc.) entfernen.

4. REZEPT.ZUBEREITUNG:
   - Original-Schritte als Array. Werbung ("Anzeige- eigene Gewürze...")
     und Hashtags am Ende entfernen.

5. AUFWAND — Schätze: 4–6 simple Schritte = 15 Min, 7–10 = 30 Min,
   viel Vorbereitung/Backen = 45 Min, mehrstündig = 60+ Min.

6. GESUND — true wenn überwiegend frische Zutaten und wenig Sahne/Käse/
   Zucker/Frittiertes. Sonst false.
```

### One-Shot-Beispiel

In den Prompt wird ein Input/Output-Pair eingefügt (basierend auf dem real getesteten "Ofen Feta Hähnchen Pasta"-Reel von `joeskochwelt`). Kostet ~600 Tokens, drückt Fehlerrate stark.

### Robustheits-Check (server-seitig nach Claude-Response)

Nach JSON-Parse:
- Wenn `zutaten.length === 0 && rezept.zubereitung.length === 0` → fail, Reel enthält kein erkennbares Rezept
- Wenn `aufwand` nicht in Whitelist → auf `'30 Min'` fallback
- Wenn `einheit` einer Zutat nicht in Whitelist → diese Zutat aus `zutaten[]` droppen (lesbares Original bleibt im Rezept)

---

## iOS-Shortcut

### Verhalten

Im Insta-Share-Sheet erscheint "An Jarvis senden". Tap → Shortcut führt im Hintergrund einen POST aus → iOS-Notification mit Erfolg/Fehler. Kein Safari, kein App-Wechsel. Insta bleibt im Vordergrund.

### Aufbau (4 Actions)

Tatsächlich umgesetzte Variante — vereinfacht durch das `display`-Feld der Server-Response, sodass iOS-Shortcuts keine `If`-Logik braucht:

```
[Action 1] URLs aus Share-Sheet erhalten
   Eingabetyp: URLs (Häkchen NUR bei URLs)
   Wenn keine Eingabe: Fortfahren

[Action 2] Inhalte von URL abrufen
   URL: <PRODUCTION-URL>/api/instagram/import
   Methode: POST
   Haupttext anfordern: JSON
     - Schlüssel "url" → Wert: Kurzbefehleingabe (Variable)
     - Schlüssel "token" → Wert: <INSTA_IMPORT_TOKEN>

[Action 3] Wert aus Wörterbuch abrufen
   Schlüssel: display
   In: Inhalt der URL

[Action 4] Mitteilung anzeigen
   Text: <Wörterbuchwert aus Action 3>
```

Damit zeigt der Banner immer das passende `display`-Feld vom Server (`✓ <name>`, `↻ <name> (schon importiert)` oder `⚠️ <error>`) — keine Conditional-Logik im Shortcut nötig.

### Setup-Workflow

1. Thomas baut den Shortcut einmal auf seinem iPhone mit dem echten Token
2. Shortcut → "Teilen" → iCloud-Link generieren → an Katja schicken
3. Katja tippt den Link an → "Hinzufügen" → fertig
4. Ab jetzt erscheint "An Jarvis senden" in jedem Insta-Share-Sheet

### Token-Rotation (bei Leak)

1. ENV `INSTA_IMPORT_TOKEN` in Coolify ändern
2. Neuen Shortcut bauen, neuen iCloud-Link an Katja
3. Alten Shortcut auf Katjas Gerät löschen

---

## Fehlerbehandlung (Übersicht)

Notification-Text = `display`-Feld der Server-Response, wird im iOS-Shortcut 1:1 als Mitteilung angezeigt.

| Fehlerquelle | Server-Verhalten | Notification-Text |
|---|---|---|
| Token fehlt/falsch | `{ ok: false }` | `⚠️ Ungültiger Token` |
| URL-Format ungültig | `{ ok: false }` | `⚠️ Keine gültige Instagram-URL` |
| Insta liefert kein og:description | `{ ok: false }` | `⚠️ Konnte das Reel nicht öffnen — vielleicht privat oder gelöscht?` |
| Claude-Throw (API-Outage/Quota) | `{ ok: false }` | `⚠️ Rezept konnte nicht extrahiert werden` |
| Claude-Parse fail (kaputtes JSON) | `{ ok: false }` | `⚠️ Rezept konnte nicht extrahiert werden` |
| DB-Insert fail | `{ ok: false }` | `⚠️ Speichern fehlgeschlagen` |
| Race: paralleler Doppel-Tap | `{ ok: true, existing: true }` | `↻ <Name> (schon importiert)` |
| Bereits importiert (Dedup) | `{ ok: true, existing: true }` | `↻ <Name> (schon importiert)` |
| Erfolg | `{ ok: true, existing: false }` | `✓ <Name>` |
| Unerwarteter Fehler (Outer catch) | `{ ok: false }` | `⚠️ Interner Fehler` |

---

## Sicherheit

- **Shared-Secret-Token** schützt den Endpoint vor Drive-By-Spam.
- Token-Vergleich **timing-safe** via `crypto.timingSafeEqual` — kein Side-Channel über Response-Time-Differenzen.
- Token nur in (a) Coolify-ENV und (b) iOS-Shortcut auf Katjas/Thomas' iPhones.
- Bei Verdacht auf Leak: Token rotieren (siehe oben).
- Token im Body, nicht in URL — vermeidet Log-Leakage.
- **Caption-Logging gekürzt** auf 500 Zeichen — DSGVO-Schutz, da Captions personenbezogene Inhalte (Namen, Hashtags, Affiliate-Disclaimer) enthalten können.

---

## Out-of-Scope

Bewusst nicht Teil dieser Spec — Phase 2 oder später:

- **Saved-Posts-Bulk-Import** aus Katjas privatem Insta-Account (bräuchte Login + Session-Management auf dem Server, instaloader o.ä., Bot-Detection-Risiko)
- **Audio-Transkription** wenn Rezept im Video gesprochen wird (bisher kein Bedarf — `joeskochwelt` schreibt Rezept in Caption)
- **OCR auf Reel-Frames** wenn Rezept als Grafik eingeblendet wird
- **Carousel-Posts mit Bildkacheln**: erstmal nur Caption-Text, Bilder werden ignoriert
- **Creator-Filter** (z.B. "alle Rezepte von Josef"): kein `creator_handle`-Feld bisher
- **Frontend-Page** für Import-Bestätigung: nicht nötig, Notification reicht

---

## Definition-of-Done

Implementation gilt als fertig, wenn:

1. Migration durchgelaufen, `quelle_url` + Unique-Index in DB
2. `POST /api/instagram/import` lokal getestet mit dem `joeskochwelt` Reel:
   - Erst-Import → `existing: false`, Gericht in DB mit korrekter Struktur
   - Zweit-Import gleiche URL → `existing: true`
   - Falsche Token → `ok: false`
   - Ungültige URL → `ok: false`
3. iOS-Shortcut auf Thomas' iPhone funktioniert end-to-end (Insta-Share → Notification)
4. iCloud-Link an Katja geschickt, sie hat den Shortcut installiert und einen Test-Import gemacht
5. Importiertes Gericht ist in der App unter Kategorie "instagram" sichtbar, Rezept lesbar, Zutaten erscheinen in Picnic-Suche bei Wochenplan-Aufnahme
