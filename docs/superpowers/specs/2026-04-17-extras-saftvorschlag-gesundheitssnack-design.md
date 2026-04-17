# Spec: Saftvorschlag & Gesundheitssnack

**Datum:** 2026-04-17  
**Status:** Bereit zur Implementierung

---

## Überblick

Zwei neue fixe Wochenplan-Slots:
- **Gesundheitssnack** — Dienstag + Donnerstag (4. Karte unter den Mahlzeiten)
- **Saftvorschlag** — Samstag (4. Karte unter den Mahlzeiten)

Optimiert für Ben (11 J., 146cm, 35kg) und Marie (8 J., 130cm, 24kg), beide sehr sportlich aktiv. Die Slots sind nicht tauschbar — fester Bestandteil des Wochenplans.

---

## Datenhaltung (Supabase)

### Tabelle: `extras_katalog`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | uuid | PK |
| `typ` | enum `snack` \| `saft` | Art des Extras |
| `name` | text | Name des Snacks / Safts |
| `zubereitung` | text | Kurze Anleitung (1–3 Schritte) |
| `geraet` | enum `entsafter` \| `mixer` \| `keine` | Benötigtes Gerät (Braun Multipack 5 / Philips Pro Blend 6 3D) |
| `naehrstoffe` | jsonb | Nährstoffe pro Portion: Protein, Calcium, Eisen, Zink, Vit. A/C/D/K, B1/B2/B6/B12, Folsäure, Omega-3, Magnesium, Kalium (alle in mg oder µg) |
| `portion_g` | integer | Portionsgröße in Gramm |
| `saison` | int[] | Monate in denen der Snack/Saft saisonal passt (1–12), leer = ganzjährig |
| `geschmacks_hinweis` | text | Kindgerechter Geschmackstipp (z.B. "Spinat mit Mango und Banane kombinieren — Bitterkeit verschwindet vollständig") |

### Tabelle: `extras_wochenplan`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | uuid | PK |
| `wochenplan_id` | uuid | FK → `wochenplaene.id` |
| `katalog_id` | uuid | FK → `extras_katalog.id` |
| `typ` | enum `snack` \| `saft` | |
| `tag` | text | `dienstag` \| `donnerstag` \| `samstag` |
| `begruendung` | text | Claude's Begründung (z.B. "Deckt 80% des Wochenbedarfs an Vitamin D") |
| `naehrstoffe_snapshot` | jsonb | Kopie der Nährstoffe zum Zeitpunkt der Planung |
| `erstellt_am` | timestamptz | |

### Tabelle: `kinder_naehrstoff_profil`

Einmalig gesetzt, statisch bis zur manuellen Anpassung.

| Feld | Wert |
|------|------|
| Ben: Alter | 11 (geb. 09.01.2015) |
| Ben: Größe | 146 cm |
| Ben: Gewicht | 35 kg |
| Marie: Alter | 8 (geb. 08.04.2018) |
| Marie: Größe | 130 cm |
| Marie: Gewicht | 24 kg |
| Aktivitätslevel | sehr aktiv (Sport mehrmals pro Woche) |

Daraus abgeleiteter täglicher Nährstoffbedarf pro Kind (basierend auf DGE-Referenzwerten für Kinder, angepasst für hohes Aktivitätslevel) wird als JSON gespeichert.

---

## Research-Referenzdatei

Vor der Implementierung wird eine Referenzdatei `docs/ernaehrung-kinder-referenz.md` erstellt mit:

1. **DGE-Referenzwerte** für Kinder 8–12 Jahre (Protein, Calcium, Eisen, Zink, alle Vitamine, Mineralstoffe)
2. **Erhöhter Bedarf bei sportlicher Aktivität** (Protein, Eisen, Magnesium, Elektrolyte)
3. **Kindgerechter Geschmack**: Welche Kombinationen Bitterkeit/Schärfe/Eigengeschmack gesunder Zutaten abmildern (nur geschmacklich, keine Präsentation)
4. **Geräte-Referenz**: Was Braun Multipack 5 (Entsafter) und Philips Pro Blend 6 3D (Mixer) können und welche Zutaten für welches Gerät geeignet sind
5. **Kuratierter Starter-Katalog**: ~40 Snacks + ~20 Säfte mit vollständigen Nährstoffprofilen

---

## Claude-Auswahl-Logik

### Trigger
Wird beim Generieren des Wochenplans aufgerufen (`/api/wochenplan/generate`).

### Ablauf

1. **Nährstoff-History laden**: Letzte 4 Wochen `extras_wochenplan` → kumulierte gelieferte Nährstoffe berechnen
2. **Gap-Vektor berechnen**: Geliefert vs. Wochenbedarf (Ben + Marie kombiniert) → prozentualer Erfüllungsgrad pro Nährstoff
3. **Claude-Prompt zusammenstellen**:
   - Kinder-Profile mit Tagesbedarf
   - Gap-Vektor der letzten Wochen
   - Vollständiger `extras_katalog` als JSON
   - Aktueller Monat (Saisonalität)
   - Letzte 4 Wochen Auswahl (Abwechslung sicherstellen)
   - Geschmackshinweise aus dem Katalog
4. **Claude gibt zurück**: 2 Snacks (Di + Do) + 1 Saft (Sa) mit je einer kurzen Begründung (max. 60 Zeichen)
5. **Optional**: Falls Claude einen sinnvollen neuen Snack/Saft vorschlägt der nicht im Katalog ist → `neuer_vorschlag` im Response-Objekt. Wird vorerst nur geloggt, nicht auto-hinzugefügt.

---

## UI

### Extra-Karte (Option B)

Gleiche Optik wie GerichtCard, aber:
- **Nicht tauschbar** — kein Tausch-Button, kein Action-Handler
- **Hintergrund**: Snack → `#f0fdf4` (grün-weiß), Saft → `#fffbeb` (gelb-weiß)
- **Aufbau**:
  - Label (klein, grau): `Gesundheitssnack` oder `Saftvorschlag`
  - Name + Icon rechts daneben (🥗 Snack, 🥤 Saft)
  - Darunter: Claude's Begründung in kleiner grauer Schrift

### Betroffene Tage & Position

| Tag | Slot | Typ |
|-----|------|-----|
| Dienstag | nach Abend | Gesundheitssnack |
| Donnerstag | nach Abend | Gesundheitssnack |
| Samstag | nach Frühstück | Saftvorschlag |

### Carry-Over

Carry-Over-Tage (Fr/Sa/So der letzten Woche) zeigen die Extra-Karten read-only falls vorhanden.

---

## Einkaufsliste

Die Zutaten der Extras werden in die Einkaufsliste integriert — gleiche Routing-Logik wie reguläre Gerichte (Picnic / Bring).

---

## Offene Punkte (nicht in dieser Phase)

- Admin-UI zum Hinzufügen neuer Katalog-Einträge (vorerst manuell per Supabase)
- Auto-Add von Claude's Neuvorschlägen in den Katalog
- Individuelle Nährstoff-Anzeige pro Kind

---

## Implementierungs-Reihenfolge

1. Research-Referenzdatei erstellen (`docs/ernaehrung-kinder-referenz.md`) mit Starter-Katalog
2. Supabase-Migrationen: 3 neue Tabellen + Seed für `kinder_naehrstoff_profil`
3. Seed für `extras_katalog` (~40 Snacks, ~20 Säfte)
4. `lib/extras.ts` — Nährstoff-Gap-Berechnung + Claude-Auswahl-Logik
5. `/api/wochenplan/generate` erweitern — Extras parallel zum Plan generieren
6. `WochenplanGrid` erweitern — Extra-Karte für Di/Do/Sa rendern
7. Einkaufsliste: Extras-Zutaten einbeziehen
