# Implizites Feedback-System — Design Spec

**Datum:** 2026-04-14
**Status:** Approved

## Ziel

Gerichte die regelmäßig aus Wochenplänen weggétauscht werden, automatisch identifizieren und langfristig aus dem aktiven Gerichte-Pool entfernen. Kein explizites Bewertungs-UI — das Signal entsteht durch Nutzerverhalten.

---

## Datenbankänderung

Neue Migration (`supabase/migration_feedback.sql`):

```sql
ALTER TABLE gerichte ADD COLUMN tausch_count INT DEFAULT 0;
ALTER TABLE gerichte ADD COLUMN gesperrt BOOLEAN DEFAULT FALSE;
```

---

## Tausch-Flow

Wenn der Nutzer auf der Wochenplan-Seite "Tauschen" klickt:

1. Das bisherige Verhalten bleibt: ein zufälliges, **nicht gesperrtes** Gericht wird gewählt
2. Parallel sendet der Client `PATCH /api/gerichte/[id]/tauschen` mit der ID des **ersetzten** Gerichts
3. Die Route erhöht `tausch_count += 1`
4. Wenn `tausch_count >= 4`: `gesperrt = true` wird automatisch gesetzt

---

## Claude-Integration

In `lib/wochenplan.ts` (Gerichte-Abfrage für Claude):

```typescript
.from('gerichte')
.select('*')
.eq('gesperrt', false)  // neu: gesperrte Gerichte ausblenden
```

Gesperrte Gerichte kommen Claude nie zu Gesicht und werden folglich nie vorgeschlagen.

---

## Gerichte-Seite (UI)

Die bestehende `/gerichte` Seite bekommt einen zweiten Abschnitt unterhalb der normalen Liste:

**"Gesperrt (X)"** — alle Gerichte mit `gesperrt = true`, sortiert nach `tausch_count` absteigend.

Pro Gericht werden angezeigt:
- Name
- Tausch-Zähler (z.B. "4x getauscht")
- Button **Löschen** — permanent aus DB entfernen
- Button **Reaktivieren** — setzt `tausch_count = 0` und `gesperrt = false`, Gericht ist wieder aktiv

---

## Neue API Routes

### `PATCH /api/gerichte/[id]/tauschen`

- Liest aktuellen `tausch_count`
- Setzt `tausch_count += 1`
- Wenn neuer Wert >= 4: setzt zusätzlich `gesperrt = true`
- Gibt das aktualisierte Gericht zurück

### `PATCH /api/gerichte/[id]/reaktivieren`

- Setzt `tausch_count = 0`
- Setzt `gesperrt = false`
- Gibt das aktualisierte Gericht zurück

### `DELETE /api/gerichte/[id]`

- Bereits geplant/vorhanden oder neu anzulegen
- Löscht das Gericht permanent aus der DB

---

## Nicht im Scope

- Kein Verlaufs-Log (wann wurde wann getauscht)
- Kein automatisches Löschen — immer manuell durch den Nutzer
- Kein per-Person Feedback
