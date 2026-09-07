# Vorrat-Tracker — Design

**Ziel:** Automatisches Bestandstracking für Vorratsgüter (haltbarkeit_tage ≥ 14). Beim Generieren der Einkaufsliste werden Artikel übersprungen, die noch ausreichend im Vorrat vorhanden sind. Der Picnic-Produktname wird in der Einkaufsübersicht angezeigt.

**Architektur:** Neue Supabase-Tabelle `vorrat`. Neue Hilfsbibliothek `lib/vorrat.ts` kapselt Einheitenkonvertierung, Paketgrößen-Parsing und DB-Zugriffe. `generiereEinkaufslisten()` bekommt Vorrat-Daten und filtert Artikel heraus. `/api/einkaufsliste/senden` aktualisiert den Vorrat und gibt Picnic-Produktnamen zurück.

**Tech Stack:** Next.js App Router, Supabase (supabase-js), TypeScript, Jest

---

## Datenbankschema

Tabelle `vorrat`:

```sql
CREATE TABLE IF NOT EXISTS vorrat (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zutat_name    text NOT NULL UNIQUE,   -- normalisiert: lowercase, getrimmt
  bestand       numeric NOT NULL DEFAULT 0,
  einheit_basis text NOT NULL,          -- 'g' | 'ml' | 'stueck'
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vorrat_zutat_name_idx ON vorrat (zutat_name);
```

---

## Einheitenkonvertierung

Beim Einbuchen und Abziehen wird immer in die Basiseinheit konvertiert:

| Einheit | Basiseinheit | Faktor |
|---------|-------------|--------|
| g       | g           | 1      |
| kg      | g           | 1000   |
| ml      | ml          | 1      |
| l       | ml          | 1000   |
| cl      | ml          | 10     |
| TL      | g           | 5      |
| EL      | g           | 15     |
| Stück / Bund / Packung | stueck | 1 |
| (unbekannt) | stueck | 1 |

Nur Zutaten mit `haltbarkeit_tage >= 14` werden getrackt.

---

## Paketgrößen-Parsing

```ts
// Beispiele:
// "FUCHS Kreuzkümmel gemahlen 35g"  → { wert: 35, einheit: 'g' }
// "Bertolli Olivenöl 500ml"         → { wert: 500, einheit: 'ml' }
// "Barilla Spaghetti 500g"           → { wert: 500, einheit: 'g' }
// "Netto Eier 6er"                  → null (kein Match → kein Tracking)
```

Regex: `/(\d+(?:[,.]\d+)?)\s*(g|kg|ml|l|cl)/i`

Bei `null` → kein Eintrag in `vorrat` für diesen Artikel. Keine Fehlerbehandlung nötig — der Artikel wird nächste Woche einfach wieder eingekauft.

---

## Dateistruktur

| Datei | Aktion |
|-------|--------|
| `lib/vorrat.ts` | Neu — `normalisiereEinheit`, `parsePaketgroesse`, `ladeVorrat`, `aktualisiereVorrat`, `istTracked` |
| `__tests__/lib/vorrat.test.ts` | Neu — Tests für alle Hilfsfunktionen |
| `lib/einkaufsliste.ts` | Modify — `generiereEinkaufslisten` bekommt `vorrat`-Parameter, gibt `ausVorrat`-Liste zurück |
| `__tests__/lib/einkaufsliste.test.ts` | Modify — Tests für Vorrat-Filterung |
| `app/api/einkaufsliste/senden/route.ts` | Modify — Vorrat laden, übergeben, nach Senden aktualisieren; Picnic-Produktnamen im Response |
| `types/index.ts` | Modify — neue Typen: `VorratEintrag`, `EinkaufslistenErgebnisErweitert` |

---

## Kernlogik: `lib/vorrat.ts`

```ts
export interface VorratEintrag {
  zutat_name: string
  bestand: number
  einheit_basis: 'g' | 'ml' | 'stueck'
}

export interface NormierteMenge {
  wert: number
  basis: 'g' | 'ml' | 'stueck'
}

export function istTracked(haltbarkeitTage: number): boolean {
  return haltbarkeitTage >= 14
}

export function normalisiereEinheit(menge: number, einheit: string): NormierteMenge

export function parsePaketgroesse(produktName: string): NormierteMenge | null

export async function ladeVorrat(): Promise<VorratEintrag[]>

export async function aktualisiereVorrat(
  kaeufe: Array<{ zutat_name: string; paket: NormierteMenge | null; verbrauch: NormierteMenge }>,
  // paket ist null wenn Parsing fehlschlug — dann nur verbrauch abziehen, kein Einbuchen
  ausVorrat: Array<{ zutat_name: string; verbrauch: NormierteMenge }>
): Promise<void>
```

---

## Geänderter Rückgabetyp von `generiereEinkaufslisten`

```ts
export interface EinkaufslistenErgebnisErweitert {
  einkauf1: EinkaufsItem[]
  einkauf2: EinkaufsItem[]
  ausVorrat: EinkaufsItem[]   // Zutaten mit haltbarkeit >= 14 die aus Vorrat gedeckt sind
}
```

`generiereEinkaufslisten` bekommt neuen Parameter `vorrat: VorratEintrag[]`. Für jede Zutat mit `haltbarkeit_tage >= 14`: wenn Vorrat ≥ Rezeptmenge → in `ausVorrat` statt `einkauf1`.

---

## API Response `/api/einkaufsliste/senden`

```ts
{
  listen: {
    picnic: Array<{
      picnicProdukt: string   // Produktname von Picnic, z.B. "FUCHS Kreuzkümmel gemahlen 35g"
      // kein 'name', keine 'menge', keine 'einheit' — Produktname reicht
    }>
    bring1: EinkaufsItem[]    // unverändert
    bring2: EinkaufsItem[]    // unverändert
    ausVorrat: EinkaufsItem[] // neu — Zutaten die aus Vorrat gedeckt wurden
  }
}
```

**Ablauf im POST-Handler:**
1. Vorrat aus Supabase laden (`ladeVorrat()`)
2. Vorrat an `generiereEinkaufslisten()` übergeben → bekommt `ausVorrat`-Liste zurück
3. Picnic-Suche wie bisher; Produktnamen aus `sucheArtikel().name` mitführen
4. Nach erfolgreichem Senden: `aktualisiereVorrat()` aufrufen
   - Für jeden Picnic-Kauf: `paket` aus Produktnamen parsen, `verbrauch` aus Rezeptmenge
   - Für "aus Vorrat"-Artikel: nur `verbrauch` abziehen

---

## UI: Einkaufsübersicht

**Picnic-Liste:** Nur Picnic-Produktname anzeigen (kein Zutatenname, keine Menge):
```
┌─ Picnic ──────────────────────────────┐
│  FUCHS Kreuzkümmel gemahlen 35g       │
│  Barilla Spaghetti 500g               │
│  Bertolli Olivenöl extra vergine 500ml│
└───────────────────────────────────────┘
```

**Bring-Listen:** unverändert (Zutatenname + Menge).

**Neue Sektion "Aus dem Vorrat"** — am Ende, leicht abgesetztes Design:
```
┌─ Aus dem Vorrat ──────────────────────┐
│  Olivenöl               2 EL          │
│  Paprikapulver          1 TL          │
│  Pasta                400 g           │
└───────────────────────────────────────┘
```

Die Sektion erscheint nur wenn `ausVorrat.length > 0`.

---

## Fehlerverhalten

- Parsing schlägt fehl (kein Gewicht im Produktnamen) → kein Vorrat-Eintrag, kein Fehler
- Supabase-Fehler beim Vorrat-Update → still schlucken (wie bei claude-tracking), Einkauf trotzdem erfolgreich
- Vorrat-Tabelle leer / nicht vorhanden → leerer Array, alle Artikel werden normal eingekauft
