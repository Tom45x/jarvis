# Spec: Einkaufsliste — Logik-Redesign

**Datum:** 2026-04-24
**Status:** Bereit zur Implementierung

---

## Überblick

Die Einkaufsliste wird vom flüchtigen Einmal-Snapshot (sessionStorage) zu einem
persistenten, lebenszyklus-bewussten Objekt umgebaut. Ziel: Nach dem initialen
Senden einer Woche soll die Einkaufsliste **nicht mehr komplett überschrieben**
werden, sobald Katja Gerichte tauscht. Stattdessen:

- Eingefrorene Sektionen (Picnic nach Bestellung, Bring nach Einkaufstag)
  bleiben unangetastet.
- Noch offene Sektionen werden automatisch per Diff aktualisiert.
- Katja kann die Liste vor dem Senden ansehen und Zutaten streichen.
- Die Liste ist jederzeit ab Plan-Genehmigung einsehbar (nicht erst nach Senden).

Das beseitigt den aktuellen Bug-ähnlichen Zustand, dass eine spontane
Gericht-Änderung am Montag den kompletten Freitag-Einkauf invalidiert.

---

## Lebenszyklus der Einkaufsliste

Fünf Zustände, die durch Zeit, Picnic-Status und User-Aktion ausgelöst werden:

| Zustand | Auslöser | Eigenschaft |
|---|---|---|
| **(0) Kein Plan / Entwurf** | Plan existiert nicht oder ist `entwurf` | Keine Liste, Button deaktiviert |
| **(1) Berechnet** | Plan wird auf `genehmigt` gesetzt | Liste wird automatisch berechnet und in DB persistiert; in Sheet einsehbar; Streichen möglich; Senden-Button sichtbar |
| **(2) Gesendet** | User klickt in Sheet "Senden" | Picnic-Warenkorb + Bring-Listen gefüllt; Zeitpunkt + Snapshot in DB; Sheet read-only |
| **(3) Teil-eingefroren** | Einkaufstag 1 erreicht **oder** Picnic-Bestellung erkannt | Einzelne Sektionen nicht mehr Diff-targets |
| **(4) Komplett eingefroren** | Einkaufstag 2 erreicht + Picnic bestellt | Alle Sektionen fix, keine Änderungen mehr möglich |

Transitions (2) → (3) → (4) passieren passiv und sind kein DB-Status, sondern
**zur Laufzeit berechnet** aus Zeit und Picnic-Bestellstatus. Kein Cron-Job nötig.

---

## Datenmodell (Supabase)

### Tabelle `einkaufslisten` — erweitern

Die bestehende Tabelle wird um Sektions-Spalten und Status-Felder ergänzt.

```sql
alter table einkaufslisten
  add column picnic jsonb not null default '[]',           -- Array<{picnicProdukt, menge, einheit, artikelId}>
  add column bring1 jsonb not null default '[]',           -- EinkaufsItem[]
  add column bring2 jsonb not null default '[]',           -- EinkaufsItem[]
  add column aus_vorrat jsonb not null default '[]',       -- EinkaufsItem[] (nur Info)
  add column gestrichen jsonb not null default '[]',       -- string[] (Zutat-Namen, nur aktuelle Runde)
  add column gesendet_am timestamptz,                      -- null = noch nicht gesendet
  add column gesendet_snapshot jsonb,                      -- { picnic, bring1, bring2 } zum Send-Zeitpunkt
  add column sync_fehler jsonb;                            -- { sektion, fehler, timestamp } | null

create unique index einkaufslisten_wochenplan_id_unique
  on einkaufslisten(wochenplan_id);
```

### Spalten-Erklärung

| Spalte | Zweck |
|---|---|
| `picnic`, `bring1`, `bring2` | Aktueller Inhalt der jeweiligen Sektion (lebendes Objekt, wird bei Tausch aktualisiert) |
| `aus_vorrat` | Info-Sektion (aus Vorrat verbrauchte Artikel), keine API-Wirkung |
| `gestrichen` | Zutaten, die Katja vor dem Senden manuell rausgeworfen hat. Gilt nur für diese Runde, wird beim Berechnen neu angewendet. |
| `gesendet_am` | `null` = Zustand (1) Berechnet, `not null` = Zustand (2)+ |
| `gesendet_snapshot` | Kopie der drei Sektionen zum Send-Zeitpunkt. Einziger Referenzpunkt für den Diff bei späteren Tauschen. |
| `sync_fehler` | Gefüllt, wenn Bring-/Picnic-API bei einem Diff-Update fehlschlug. Wird beim nächsten App-Öffnen automatisch versucht zu re-syncen. |

### Einfrier-Status — zur Laufzeit berechnet

```ts
function bestimmeEinfrierstatus(now: Date): {
  picnicFrozen: boolean
  bring1Frozen: boolean
  bring2Frozen: boolean
} {
  const wochentag = now.getDay() === 0 ? 7 : now.getDay()  // 1 = Mo, 7 = So
  return {
    picnicFrozen: await picnic_bestellung_status.bestellung_erkannt,
    bring1Frozen: wochentag >= EINKAUFSTAG_1,
    bring2Frozen: wochentag >= EINKAUFSTAG_2,
  }
}
```

`EINKAUFSTAG_1` und `EINKAUFSTAG_2` sind bereits als ENV-Vars konfiguriert.
Picnic-Bestellstatus kommt aus der bestehenden Tabelle `picnic_bestellung_status`.

---

## Flow — Aus Katjas Perspektive

### Szenario A: Normalfall (Freitag plant → Samstag bestellt → Dienstag tauscht)

1. **Freitag 18:00** — Katja generiert Plan, genehmigt ihn.
   → Backend berechnet Einkaufsliste automatisch, persistiert in DB.
   → Toast: *"Einkaufsliste bereit"*. Button zeigt *"Einkaufsliste · Entwurf"*.
2. **Freitag 18:02** — Katja öffnet Sheet, streicht "Butter" (hat sie noch zu Hause).
   → `gestrichen: ["Butter"]`, Liste neu dargestellt mit durchgestrichener Butter.
3. **Freitag 18:03** — Katja klickt unten in Sheet "An Picnic + Bring senden".
   → Alle drei APIs werden gefüttert, `gesendet_am` + `gesendet_snapshot` gesetzt.
   → Sheet ist jetzt read-only. Button zeigt *"Einkaufsliste · Gesendet"*.
4. **Samstag 09:00** — Katja tätigt den Picnic-Einkauf.
   → Poll auf `/api/picnic/bestellung-status` ergibt `bestellung_erkannt = true`.
   → Button zeigt *"Einkaufsliste · Bestellt"*. Sheet zeigt grüne Haken pro Picnic-Artikel, gelbe Warnung wenn Artikel fehlen.
5. **Dienstag 15:00** — Katja tauscht das Donnerstag-Gericht.
   → `PUT /api/wochenplan` löst Diff aus.
   → Einfrier-Check: picnicFrozen = true, bring1Frozen = true (Dienstag > Einkaufstag 1 = Mo), bring2Frozen = false (Di < Einkaufstag 2 = Do).
   → Nur `bring2` wird neu berechnet, Bring-API Full-Replace, Snapshot aktualisiert.
   → Toast: *"Bring-Einkauf 2 aktualisiert: +Zucchini, −Paprika"*.

### Szenario B: Spät-Tausch ohne Wirkung

Katja tauscht Mittwochabend ein Mittwochs-Gericht.
→ Diff-Berechnung: Änderung betrifft nur Bring-1-Zutaten (bereits frozen).
→ Nichts passiert an APIs. Kein Toast (stiller Diff = Benutzerin braucht keine Info).
→ DB-Zeile bleibt unverändert.

### Szenario C: Bring-API fällt aus

Katja tauscht, Bring-API antwortet mit Fehler.
→ Plan-Update läuft durch (Wochenplan-Tabelle wird aktualisiert).
→ Einkaufslisten-Update an Bring-API schlägt fehl.
→ `sync_fehler` wird gesetzt: `{ sektion: "bring2", fehler: "Bring API timeout", timestamp: ... }`.
→ Toast: *"Plan geändert — Bring-Synchronisation läuft im Hintergrund weiter"*.
→ Beim nächsten App-Öffnen (Layout-Mount) wird `sync_fehler` erkannt und automatisch nachgeholt.

---

## UI-Änderungen

### Wochenplan-Seite (`app/app/wochenplan/page.tsx`)

**Entfällt:**
- Bestellstatus-Banner oben (wandert in die Sheet).
- Der doppelte Button-State (*Senden* / *Ansehen*) — stattdessen nur noch *Einkaufsliste*.
- sessionStorage-Handhabung komplett weg.

**Neu:**
- Ein einzelner Button am unteren Rand: *"Einkaufsliste"* mit dezentem Status-Suffix:
  - `aktiverPlan === null` → Button ausgeblendet
  - Plan-Status `entwurf` → Button deaktiviert mit Text *"Einkaufsliste · Plan nicht genehmigt"*
  - Plan-Status `genehmigt`, `gesendet_am IS NULL` → *"Einkaufsliste · Entwurf"*
  - Plan-Status `genehmigt`, `gesendet_am NOT NULL`, Picnic nicht bestellt → *"Einkaufsliste · Gesendet"*
  - Picnic bestellt → *"Einkaufsliste · Bestellt"*, mit gelbem Punkt bei fehlenden Artikeln
- Klick öffnet das Sheet.

### Einkaufslisten-Sheet (`app/components/EinkaufslisteSheet.tsx`)

Komplett neu aufgebaut. Sektionen von oben nach unten:

1. **Header**: Titel, Statuszeile (*"Entwurf — noch nicht gesendet"* / *"Gesendet am Fr, 18:24"* / *"✓ Bestellt am Sa, 09:12 — 12 Artikel"*).
2. **Sektion Picnic**:
   - Zustand (1): Liste mit `×`-Button pro Zeile. Gestrichene Items bleiben sichtbar, Text durchgestrichen, Button wird zu "Rückgängig".
   - Zustand (2): nur Liste, kein `×`.
   - Zustand (3)+ mit Bestellung: grüne Häkchen pro bestellten Artikel; fehlende Artikel in gelbem Hinweiskasten.
3. **Sektion Bring-Einkauf 1** — analog ohne Bestell-Status.
4. **Sektion Bring-Einkauf 2** — analog.
5. **Sektion Aus dem Vorrat** — immer nur Info, kein Streichen.
6. **Footer**:
   - Zustand (1): Primär-Button *"An Picnic + Bring senden"*. Wenn `gestrichen.length > 0`: kleiner Hinweis *"N Zutaten werden nicht gesendet"*.
   - Zustand (2)+: kein Button, nur Status.

### Toasts (`/wochenplan` Seite)

Neue Trigger:
- Nach erfolgreicher Plan-Genehmigung und Listen-Berechnung: *"Einkaufsliste bereit"*.
- Nach erfolgreichem Sync-Retry beim App-Öffnen: *"Einkaufsliste wieder synchron"*.
- Nach Gericht-Tausch mit Diff-Wirkung: *"Bring-Einkauf N aktualisiert: +A, −B"*.
- Nach Gericht-Tausch ohne Wirkung: **kein Toast**.
- Fehler-Toasts wie bisher.

---

## Backend-Änderungen

### Neue/geänderte API-Routen

**`PUT /api/wochenplan` — Genehmigen (`status: 'genehmigt'`)**

Bestehender Handler wird erweitert: nach erfolgreichem Status-Wechsel auf
`genehmigt` wird die Einkaufsliste synchron berechnet und persistiert.

```ts
// Pseudocode
if (neuerStatus === 'genehmigt' && alterStatus !== 'genehmigt') {
  const listen = await berechneEinkaufsliste(plan)   // siehe unten
  await supabase.from('einkaufslisten').upsert({
    wochenplan_id: plan.id,
    picnic: listen.picnic,
    bring1: listen.bring1,
    bring2: listen.bring2,
    aus_vorrat: listen.ausVorrat,
    gestrichen: [],
    gesendet_am: null,
    gesendet_snapshot: null,
    sync_fehler: null,
  }, { onConflict: 'wochenplan_id' })
}
```

**`PUT /api/wochenplan` — Gericht-Tausch (`status` bleibt)**

Bei `PUT` mit `eintraege`-Änderung, wenn eine Einkaufsliste zum Plan existiert:

```ts
// Nach dem Plan-Update:
const liste = await supabase.from('einkaufslisten')
  .select('*').eq('wochenplan_id', plan.id).single()

if (liste) {
  const neueListen = await berechneEinkaufsliste(plan, liste.gestrichen)

  if (!liste.gesendet_am) {
    // Zustand (1): einfach überschreiben, kein Diff
    await supabase.from('einkaufslisten').update({
      picnic: neueListen.picnic,
      bring1: neueListen.bring1,
      bring2: neueListen.bring2,
      aus_vorrat: neueListen.ausVorrat,
    }).eq('wochenplan_id', plan.id)
  } else {
    // Zustand (2)+: Diff-Logik
    await fuehreDiffUpdateDurch(liste, neueListen)
  }
}
```

**`POST /api/einkaufsliste/senden`** (bestehend, umgebaut)

- Liest die DB-Liste statt sie on-the-fly zu berechnen.
- Filtert gestrichene Zutaten raus.
- Füttert APIs wie heute (Picnic-Warenkorb + 2× Bring).
- Setzt `gesendet_am = now()`, `gesendet_snapshot = { picnic, bring1, bring2 }`.

**`PATCH /api/einkaufsliste/streichen`** (neu)

```ts
body: { zutatName: string, streichen: boolean }
```

Aktualisiert das `gestrichen`-Array auf der aktuellen Liste. Keine API-Wirkung
(sendet nicht). Rückgabe: aktualisierte Liste.

**`GET /api/einkaufsliste`** (neu, ersetzt sessionStorage)

Liest die aktuelle Liste aus DB und gibt sie ans Frontend zurück. Beim App-
Start auf der Wochenplan-Seite aufgerufen, um die Sheet-Daten vorzuladen.

**`POST /api/einkaufsliste/sync-retry`** (neu, für 5.6 Recovery)

Beim App-Öffnen / Layout-Mount wird einmalig `sync_fehler` geprüft. Wenn
gefüllt → versucht Backend den Diff nachzuholen. Bei Erfolg: Feld auf `null`,
Toast. Bei erneutem Fehler: Feld bleibt, kein Toast.

### Neuer Helper `fuehreDiffUpdateDurch`

```ts
async function fuehreDiffUpdateDurch(
  alteListe: Einkaufsliste,
  neueListen: BerechneteListen
): Promise<void> {
  const { picnicFrozen, bring1Frozen, bring2Frozen } = await bestimmeEinfrierstatus(new Date())
  const snapshot = alteListe.gesendet_snapshot!

  const aenderungen: DiffUpdate[] = []

  if (!bring1Frozen && !istGleich(snapshot.bring1, neueListen.bring1)) {
    try {
      await aktualisiereEinkaufsliste(BRING_LIST_NAME_1, neueListen.bring1)
      aenderungen.push({ sektion: 'bring1', diff: berechneDiff(snapshot.bring1, neueListen.bring1) })
    } catch (e) {
      await setzeSyncFehler('bring1', e)
    }
  }

  if (!bring2Frozen && !istGleich(snapshot.bring2, neueListen.bring2)) {
    try {
      await aktualisiereEinkaufsliste(BRING_LIST_NAME_2, neueListen.bring2)
      aenderungen.push({ sektion: 'bring2', diff: berechneDiff(snapshot.bring2, neueListen.bring2) })
    } catch (e) {
      await setzeSyncFehler('bring2', e)
    }
  }

  if (!picnicFrozen && !istGleich(snapshot.picnic, neueListen.picnic)) {
    // Picnic Cart: entfernen + hinzufügen sequenziell
    try {
      await synchronisierePicnicWarenkorb(snapshot.picnic, neueListen.picnic)
      aenderungen.push({ sektion: 'picnic', diff: berechneDiff(snapshot.picnic, neueListen.picnic) })
    } catch (e) {
      await setzeSyncFehler('picnic', e)
    }
  }

  // DB-Update: neue Liste + neuer Snapshot (für die Sektionen, die erfolgreich synchronisiert wurden)
  await speichereAktualisierteListe(alteListe.id, neueListen, aenderungen)

  // Aenderungen werden im Response zurückgegeben, Frontend baut daraus Toast.
}
```

---

## Edge Cases — abgedeckt

| Fall | Verhalten |
|---|---|
| Streichung vor Senden, dann Gericht-Tausch | Liste wird neu berechnet, `gestrichen` wieder angewendet. |
| Mehrere Tausche hintereinander | Jeder Tausch triggert eigenen Diff, Snapshots werden fortlaufend aktualisiert. |
| Plan zurück auf `entwurf` | Liste bleibt in DB, UI blendet sie aus. Bei erneutem Genehmigen wird sie überschrieben. |
| Picnic-Bestellung nach Tausch | Picnic-Sektion ist ab dem Moment frozen, nachfolgende Tausche lassen sie unberührt. |
| Bring-API-Fehler | `sync_fehler` gesetzt, automatischer Retry beim nächsten App-Öffnen. Keine manuelle Aktion für Katja nötig. |
| Neue Woche startet | Neuer Wochenplan → neue Zeile in `einkaufslisten`. Alte Liste bleibt historisch erhalten. |
| Regelbedarf streichen | Standard-Streichen-UI. Für dauerhafte Entfernung → Einstellungen. |
| Race Condition zwei schnelle Tausche | Frontend sendet sequenziell. Falls doch parallel: akzeptieren, dass der zweite Diff auf dem ersten aufbaut. Kein expliziter Lock. |

---

## Nicht-Ziele (explizit raus aus diesem Spec)

- Mengen-Anpassung in der Sheet (nur Streichen).
- Eigene Artikel hinzufügen (z.B. "Toilettenpapier").
- Persistente "Immer-weglassen"-Liste über Runden hinweg.
- Manueller Retry-Button für Sync-Fehler (stattdessen Auto-Retry).
- Änderung der Einfrier-Regel von zeitbasiert auf manuell quittiert.

Alle davon können später nachgerüstet werden, wenn sich echter Bedarf zeigt.

---

## Offene Punkte für Implementierung

- **Migration-Strategie:** Bestehende `einkaufslisten`-Zeilen (falls welche existieren) mit `artikel jsonb` → können leer bleiben, weil der aktuelle Code sie eh nicht nutzt. Alte `artikel`-Spalte kann mit der Migration entfernt werden.
- **Sync-Retry-Trigger-Punkt:** Im Root-Layout-`useEffect` oder erst in Wochenplan-Mount? → Empfehlung: Wochenplan-Mount, weil dort ohnehin `/api/wochenplan` + `/api/picnic/bestellung-status` geladen werden. Ein zusätzlicher `GET /api/einkaufsliste` mit `sync_fehler`-Re-Try-Logik ist natürlicher Erweiterungspunkt.
- **Picnic-Cart-Sync bei Diff:** Aktuelle Picnic-API kennt `warenkorbLeeren` + `zumWarenkorb`. Für den partiellen Diff (einzelne Items austauschen) bräuchte man `ausWarenkorbEntfernen` — prüfen ob diese Funktion existiert oder im Picnic-Modul ergänzt werden muss.
