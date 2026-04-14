# Picnic-Integration — Design Spec

**Datum:** 2026-04-14
**Status:** Approved

## Ziel

Einkaufsliste automatisch zwischen Picnic (Lieferservice) und Bring (persönlicher Einkauf) aufteilen. Picnic bekommt den Großteil — ausgenommen Fleisch, Fisch, Obst und Gemüse, die immer persönlich eingekauft werden. Dazu kommt ein konfigurierbarer Regelbedarf der wöchentlich automatisch in den Picnic-Warenkorb gelegt wird.

---

## Entscheidungsmatrix

Für jede Zutat in der Einkaufsliste gilt (in dieser Reihenfolge):

1. **Zutat matcht einen Bring-Keyword** (Fleisch, Fisch, Obst, Gemüse-Begriffe) → **Bring**
2. **Zutat auf Picnic gefunden** → **Picnic-Warenkorb**
3. **Nicht gefunden** → **Bring als Fallback**
4. **Picnic-Gesamtwert < Mindestbestellwert** → alle Picnic-Artikel in Bring verschieben

**Regelbedarf** → immer Picnic, immer Einkauf 1 (unabhängig von der Matrix).

**Timing:** Die Einkauf-1 / Einkauf-2-Aufteilung gilt für beide Kanäle gleichermaßen.

---

## Datenbankänderungen

### Neue Tabelle: `regelbedarf`

```sql
CREATE TABLE IF NOT EXISTS regelbedarf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  menge NUMERIC NOT NULL,
  einheit TEXT NOT NULL
);

-- Startwerte
INSERT INTO regelbedarf (name, menge, einheit) VALUES
  ('Toast', 1, 'Packung'),
  ('Milch', 2, 'l'),
  ('Butter', 1, 'Packung'),
  ('Eier', 10, 'Stück');
```

### Neue Einträge in `einstellungen`

```sql
INSERT INTO einstellungen (key, value) VALUES
  ('picnic_mindestbestellwert', '35'),
  ('picnic_bring_keywords', '["Hähnchen","Rind","Schwein","Lachs","Thunfisch","Garnelen","Forelle","Dorade","Wolfsbarsch","Apfel","Birne","Banane","Erdbeere","Tomate","Gurke","Zucchini","Paprika","Brokkoli","Karotte","Spinat","Salat","Fenchel","Kohlrabi","Lauch"]')
ON CONFLICT DO NOTHING;
```

---

## lib/picnic.ts

Wrapper um das `picnic-api` npm-Paket:

```typescript
// Login mit Credentials aus .env.local
export async function picnicLogin(): Promise<PicnicClient>

// Sucht ein Produkt, gibt bestes Match zurück oder null
export async function sucheProdukt(client: PicnicClient, name: string): Promise<PicnicArtikel | null>

// Fügt Produkt zum Warenkorb hinzu
export async function zumWarenkorb(client: PicnicClient, artikelId: string, menge: number): Promise<void>

// Leert den Warenkorb
export async function warenkorbLeeren(client: PicnicClient): Promise<void>
```

**Env-Variablen:**
```
PICNIC_EMAIL=...
PICNIC_PASSWORD=...
```

---

## Erweiterung: `app/api/einkaufsliste/senden/route.ts`

Bisheriger Flow: Einkaufsliste → Bring

**Neuer Flow:**

```
Einkaufsliste (Einkauf1 + Einkauf2)
  ↓
Für jede Liste:
  1. Bring-Keywords matchen → Bring-Artikel
  2. Rest → Picnic-Suche
     - Gefunden → Picnic-Artikel
     - Nicht gefunden → Bring-Fallback
  3. Picnic-Wert < Mindestbestellwert? → alle Picnic-Artikel → Bring
  4. Regelbedarf → Picnic Einkauf 1 (zusätzlich)
  ↓
Parallel:
  - Bring: bestehende Logik (zwei Listen)
  - Picnic: zwei Warenkörbe (Einkauf 1 am Montag, Einkauf 2 am Donnerstag)
```

**Response** wird um Picnic-Statistik erweitert:
```json
{
  "einkauf1Count": 12,
  "einkauf2Count": 8,
  "picnic1Count": 7,
  "picnic2Count": 4,
  "picnic1Fallback": false,
  "picnic2Fallback": true
}
```

`picnicXFallback: true` bedeutet Mindestbestellwert nicht erreicht → alles in Bring gewandert.

---

## Neue Seite: `/einstellungen`

Drei Bereiche:

### 1. Regelbedarf
- Liste aller Regelbedarf-Artikel (Name, Menge, Einheit)
- Button "Artikel hinzufügen" (Inline-Formular)
- Löschen pro Artikel

### 2. Picnic-Einstellungen
- Mindestbestellwert (Zahlenfeld, Default: 35)
- Speichern → schreibt in `einstellungen`-Tabelle

### 3. Bring-Kategorien (Keywords)
- Liste der Keyword-Tags (Chips/Tags-UI)
- Tag hinzufügen / entfernen
- Speichern → schreibt in `einstellungen`-Tabelle als JSON-Array

**Navigation:** Link zur Einstellungen-Seite in der Wochenplan-Navigation ergänzen.

---

## Neue API Routes

- `GET /api/einstellungen/regelbedarf` — alle Regelbedarf-Artikel
- `POST /api/einstellungen/regelbedarf` — neuen Artikel anlegen
- `DELETE /api/einstellungen/regelbedarf/[id]` — Artikel löschen
- `GET /api/einstellungen` — alle einstellungen key-value Paare
- `PATCH /api/einstellungen` — einzelne Keys updaten

---

## Nicht im Scope

- Kein automatischer Bestellabschluss bei Picnic (nur Warenkorb befüllen)
- Kein Preisvergleich zwischen Picnic-Produkten
- Kein Picnic-Liefertermin buchen
- Keine Produkt-Qualitätsprüfung (erstes Suchergebnis wird genommen)
