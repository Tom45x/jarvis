# Design: Einkaufsübersicht & Wochenplan-Übersicht

**Datum:** 2026-04-16  
**Status:** Genehmigt

---

## Kontext

Katja nutzt die Einkaufsübersicht beim Einkaufen als Gesamtbild: Was hat Picnic übernommen, was muss sie noch über Bring kaufen? Zusätzlich möchte sie beim Einkaufen auf einen Blick sehen, was die ganze Woche geplant ist — um das mit der Einkaufsliste abzugleichen.

---

## Feature 1: Einkaufsübersicht (Bottom Sheet verbessern)

### Ziel
Den bestehenden `EinkaufslisteSheet` übersichtlicher gestalten: sofortiger Überblick, klare Trennung zwischen Picnic und Bring.

### Design: Farbige Blöcke

Jede Einkaufsroute bekommt einen farbigen Block. Kein Tab-Wechsel nötig — alles auf einmal sichtbar.

**Struktur des Sheets:**
```
┌─────────────────────────────┐
│  Einkaufsliste  · 20 Artikel │  ← Header mit Gesamtanzahl
├─────────────────────────────┤
│ [Picnic] 8 Artikel           │  ← grüner Block (#f0fae8)
│  Hähnchenbrust · Nudeln ...  │
├─────────────────────────────┤
│ [Bring · Einkauf 1] 7 Artikel│  ← oranger Block (#fff5ed)
│  Milch · Butter · Eier ...   │
├─────────────────────────────┤
│ [Bring · Einkauf 2] 5 Artikel│  ← oranger Block (#fff5ed)
│  Brot · Joghurt · Obst ...   │
└─────────────────────────────┘
```

**Farben:**
- Picnic-Block: Hintergrund `#f0fae8`, Badge-Hintergrund `#5ba832`, Badge-Text `#ffffff`
- Bring-Block: Hintergrund `#fff5ed`, Badge-Hintergrund `#f46a00`, Badge-Text `#ffffff`
- Badge zeigt Route-Name + Artikelanzahl

**Artikelliste pro Block:**
- Komprimiert: `· Artikel &nbsp; Menge Einheit` (bestehende `ItemListe`-Komponente kann weiter genutzt werden)
- Leere Blöcke werden ausgeblendet (wie bisher)

**Neu im Header:**
- Gesamtanzahl aller Artikel: `Einkaufsliste · 20 Artikel`

**Button in der Einkaufsübersicht:**
- Neuer Button „Wochenplan ansehen" am unteren Ende des Sheets → öffnet `/wochenplan/uebersicht`

---

## Feature 2: Wochenplan-Übersicht (neue Seite)

### Ziel
Neue read-only Seite, die alle 7 Tage der aktuellen Woche mit Frühstück, Mittag und Abend auf einen Blick zeigt. Rein zur Orientierung — kein Bearbeiten möglich.

### Route
`/wochenplan/uebersicht` — neue Next.js Page (`app/app/wochenplan/uebersicht/page.tsx`)

### Zugang
Button „Wochenplan ansehen" im `EinkaufslisteSheet`, unten im Sheet.

### Daten
- Lädt den aktiven Wochenplan via `GET /api/wochenplan`
- Zeigt nur `aktiverPlan.eintraege`
- Woche immer **Mo → So** (fest, unabhängig vom aktuellen Wochentag)

### Layout — Hochformat (Portrait)

Pro Tag eine Zeile: `[Kreis-Icon] [Frühstück-Karte] [Mittag-Karte] [Abend-Karte]`

```
┌────────────────────────────────────┐
│ ←  Diese Woche                      │  ← Header mit Zurück-Button
├────────────────────────────────────┤
│ Mo  │ Toast       │ Salat    │ Steak    │
│ Di  │ Toast       │ Wrap     │ Thai     │
│ Mi  │ Toast       │ Burger   │ Risotto  │
│ Do  │ Toast       │ Pasta    │ Hähnchen │
│ Fr  │ Toast       │ Linsen   │ 🍕 Film  │
│ Sa  │ Müsli       │ Flamm-k. │ Grill    │
│ So  │ Croissant   │ Suppe    │ Pizza    │
└────────────────────────────────────┘
```

- **Grid:** `grid-template-columns: 28px 1fr 1fr 1fr`
- **Kreis-Icon:** 24×24px, heutiger Tag = Rausch-Rot (`#ff385c`), andere = `#f2f2f2`
- **Mahlzeit-Karten:** `#fffbf0`, border-radius 8px, Label (Früh/Mittag/Abend) in `var(--gray-secondary)`, Gerichtsname in `var(--near-black)` bold
- **Ziel:** Alle 7 Tage ohne Scrollen sichtbar im Hochformat

### Layout — Querformat (Landscape)

Automatischer Wechsel via CSS Media Query `@media (orientation: landscape)`:

```
        │ Mo      │ Di    │ Mi     │ Do     │ Fr       │ Sa      │ So    │
Früh    │ Toast   │ Toast │ Toast  │ Toast  │ Toast    │ Müsli   │ Crois.│
Mittag  │ Salat   │ Wrap  │ Burger │ Pasta  │ Linsen   │ Flamm-k.│ Suppe │
Abend   │ Steak   │ Thai  │ Risotto│ Hähnch.│ 🍕 Film  │ Grill   │ Pizza │
```

- **Grid:** CSS-Tabelle oder `display: grid` mit `grid-template-columns: auto repeat(7, 1fr)`
- Erste Spalte: Mahlzeit-Label (Früh/Mittag/Abend)
- Alle Zellen: `#fffbf0`, kompakt
- Kein Scrollen nötig

### Interaktion
- Nur **Zurück-Button** (oben links, Rausch-Rot Pfeil) — navigiert zurück
- Kein Tauschen, kein Rezept, kein sonstiges Interagieren
- Seite aktualisiert sich automatisch wenn ein neuer Wochenplan genehmigt wird (da Daten frisch beim Öffnen geladen werden)

### Fehlerfall
- Kein aktiver Plan vorhanden: leere Zellen mit `—`

---

## Komponenten-Übersicht

| Was | Wo | Änderung |
|---|---|---|
| `EinkaufslisteSheet.tsx` | `components/` | Umbau auf farbige Blöcke + Gesamtanzahl + Button |
| `wochenplan/uebersicht/page.tsx` | `app/wochenplan/uebersicht/` | Neue Seite |

---

## Was NICHT gebaut wird
- Kein Bearbeiten in der Übersichtsseite
- Keine Push-Benachrichtigungen
- Kein Querformat-Zwang (optional, automatisch)
- Keine Checkboxen in der Einkaufsliste (Katja nutzt Bring dafür)
