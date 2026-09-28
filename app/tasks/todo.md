# Jarvis — Todo

## Infrastruktur — aktueller Stand (2026-09-07)
Die App läuft auf Coolify/Vultr unter einer `*.sslip.io`-Adresse, die sich bei
einer Server-Migration ändert (ist bereits einmal passiert, siehe unten) —
**hier die jeweils aktuelle Adresse eintragen, nicht fest im Code/Docs verankern**:

- **Aktuelle App-URL:** `https://jarvis.152.70.8.112.sslip.io`
- **Coolify-Dashboard:** `http://152.70.8.112:8000`
- **App-UUID (Coolify):** `m11cfsm5btqexjiji82rc0vg`
- Redeploy per API: `GET /api/v1/deploy?uuid=<App-UUID>` (Bearer-Token aus Coolify → Keys & Tokens, nicht hier im Klartext ablegen)
- **Auto-Deploy (seit 2026-09-28):** GitHub-Webhook im Repo (Push auf `master`)
  → `http://152.70.8.112:8000/webhooks/source/github/events/manual`, Secret =
  „GitHub Webhook Secret“ der App in Coolify. Vorher gab es keinen Webhook, ein
  Push hat also nie deployt. **Bei Server-Migration Webhook-URL in GitHub
  (Settings → Webhooks) mit anpassen.**

**Lesson vom 2026-09-07:** Der alte Server (`140.82.38.192`) war schlicht tot
(Migration auf neue IP, alte Zugangsdaten dadurch ungültig) — keine
Netzwerk-Blackhole, kein Firewall-Problem. Bei "Server nicht erreichbar" zuerst
prüfen, ob die Adresse überhaupt noch aktuell ist, bevor man tiefer im Netzwerk
forscht. Separat davon: 4 Monate lang waren lokale Commits nie gepusht worden
(`git push` gehörte nicht zur Routine) — dadurch gingen mehrere fertige Fixes
nie live, obwohl der Code stimmte. Nach jedem Fix: `git push` + `git status`
gegen `origin` verifizieren.

## Blockiert — Chefkoch-Import fertig, wartet auf Produktiv-Setup
Code ist fertig, getestet und committed (Commits `18fbf2d`, `3f54286` auf `master`,
2026-08-24). Es fehlt nur noch die Produktiv-Konfiguration:

- [ ] **`CHEFKOCH_IMPORT_TOKEN` in Coolify setzen** — Wert liegt lokal in
      `.env.local` (letzte Zeile, `CHEFKOCH_IMPORT_TOKEN=...`). Muss auf der
      **neuen** Coolify-Instanz (siehe Infrastruktur-Abschnitt oben) gesetzt
      werden — die alte Instanz/IP existiert nicht mehr. Env-Var per
      `POST /api/v1/applications/{uuid}/envs` mit Body
      `{"key":"CHEFKOCH_IMPORT_TOKEN","value":"<Wert aus .env.local>"}` setzen.
- [ ] **Redeploy anstoßen** (siehe Infrastruktur-Abschnitt oben für den Befehl)
- [ ] **iOS-Shortcut „An Jarvis senden (Chefkoch)"** bauen — Kopie des bestehenden
      Insta-Shortcuts, Ziel-URL `https://<aktuelle-domain>/api/chefkoch/import`, Token wie oben.

## Nächstes Feature
- [ ] **Bring-Update bei Tausch** — Zutaten in den Bring-Listen automatisch aktualisieren wenn ein Gericht getauscht wird

## Offen (Prio ↓)
- [ ] **Putzplan mit Katja gegenprüfen** — aus 3 handschriftlichen Scans
      transkribiert (inkl. Reinschrift). Offen: „Küche: Fronten“ steht
      wöchentlich *und* monatlich auf dem Zettel — gewollt? Korrektur per SQL
      in `putz_aufgaben` (siehe Erledigt-Eintrag)
- [ ] `__tests__/pages/gerichte-page.test.tsx` — 16 Tests schlagen fehl (auch
      ohne Putzplan-Änderungen, Stand 2026-09-28): Test erwartet Button
      „＋ Neues Gericht hinzufügen“ direkt, Seite zeigt inzwischen zuerst die
      Gruppen-Übersicht. Tests an aktuelle UI anpassen
- [ ] Katja & Marie Profile — Lieblingsgerichte, Abneigungen
- [ ] In Coolify (`http://152.70.8.112:8000` → Keys & Tokens) den ungenutzten
      zweiten alten API-Token löschen (root- oder read-only-Token, Wert nicht
      mehr bekannt) — Thomas macht das selbst bei Gelegenheit

## Erledigt
- [x] **Putzplan (2026-09-28)** — neuer Tab `/putzplan` für Katja: abhakbare
      Aufgaben pro Wochentag (Mo–Fr, wöchentlich + monatlich) plus Quartals- und
      Jahresliste. Haken setzen sich ohne Cron zurück: Erledigung wird mit
      Periodenschlüssel (`2026-W40` / `2026-09` / `2026-Q3` / `2026`, Berliner
      Zeit) in `putz_erledigungen` gespeichert. **Aufgaben pflegen nur per SQL**
      (Tabelle `putz_aufgaben`: `titel`, `beschreibung`, `rhythmus`
      woche|monat|quartal|jahr, `wochentag` 1=Mo, `sortierung`) — Katja kann in
      der App nichts anlegen/ändern (bewusst so gewünscht). Migrationen:
      `supabase/migration_putzplan.sql`, `supabase/migration_putzplan_jahr.sql`
- [x] **Projekt aufgeräumt & Onboarding erweitert (2026-09-07)** — zwei
      parallele `todo.md`-Dateien auf eine (diese hier) konsolidiert, alte
      Bauplan-Doku aus zwei Ordnern nach `docs/archiv/` zusammengeführt (15
      Pläne, alle bereits umgesetzt), dabei ein im Klartext liegendes Coolify-
      Token in 3 Dateien redigiert. `app/AGENTS.md` um Projektüberblick,
      Deployment-Workflow und Sicherheitshinweis erweitert. Claude-Memory für
      dieses Projekt erstmals befüllt (Überblick, Deployment, 3 Lessons,
      Infra-Referenzen — vorher komplett leer)
- [x] **`/session-ende`-Skill eingerichtet** — `.claude/commands/session-ende.md`,
      wird proaktiv erkannt (Verabschiedung, "fertig für heute" o.ä.) und
      sichert/dokumentiert/räumt am Sessionende automatisch auf
- [x] **Duplikat-Gerichtsname → verständliche Fehlermeldung** — Anlegen/Generieren
      eines Gerichts mit bereits existierendem Namen zeigte nur den rohen
      Postgres-Fehler oder ein generisches "Anlegen fehlgeschlagen" (zwei
      Stellen lasen die Server-Antwort gar nicht aus). Jetzt: klare Meldung
      server- und clientseitig, live auf Produktion verifiziert (2026-09-07)
- [x] **Trainingstage-Fix live verifiziert** — der Commit vom 24.08. war zwar
      im Repo, aber nie gepusht (`origin/master` hing seit dem 09.05. fest) und
      damit nie deployed. Nachgeholt, Redeploy ausgelöst, Fix live bestätigt
      (2026-09-07)
- [x] **Saftvorschlag + Gesundheitssnack** — vollständig implementiert
      (`lib/extras.ts`, `components/ExtraCard.tsx`, `api/extras/*`), in
      Wochenplan-Generierung und -Anzeige verdrahtet. War in dieser Liste
      fälschlich noch als offen geführt
- [x] **Airfryer-Kategorie + Chefkoch-Rezept-Import** — neue Kategorie "airfryer";
      Import-Endpunkt `app/api/chefkoch/import` liest schema.org/Recipe-JSON-LD
      direkt aus der Chefkoch-Seite (kein Claude nötig für Name/Zutaten-Rohtext/
      Zubereitung/Zeit), Claude normalisiert nur noch die strukturierten Zutaten
      fürs Einkaufslisten-Feature. `lib/rezept-shared.ts` neu (Zutaten-/
      Aufwand-Validierung, von Insta- und Chefkoch-Parser gemeinsam genutzt).
      39 neue/angepasste Tests, alle grün.
- [x] **Trainingstage-/Filmabend-Zwangszuordnung entfernt** — Mo/Di/Do-Abend und
      Freitagabend sind nicht mehr fest mit diesen Kategorien verdrahtet, weder
      bei der Plangenerierung noch beim manuellen Tauschen. Kategorien bleiben
      als reine Organisations-Tags erhalten.
- [x] **CLAUDE_DEV_MODE entfernt** — Credits aufgeladen, DEV_MODE aus Coolify gelöscht
- [x] **Picnic Auth-Key Setup** — PICNIC_AUTH_KEY + Email/Password in Coolify gesetzt, Code vollständig
- [x] **Claude API Tracking** — `claude_nutzung` Tabelle in Supabase, `logClaudeNutzung()` Helper, in alle 4 Claude-Calls integriert
- [x] **Gericht hinzufügen** — inline Formular mit KI-Generierung und manuellem Pfad, 16 Tests
- [x] **Lösch-Icon auf Gerichts-Kacheln** — roter Kreis oben rechts, Sicherheitsabfrage
- [x] 10-Tages-View (Fr/Sa/So carry-over + Mo–So aktive Woche)
- [x] Freitags-Button Redesign — Bearbeiten-Icon, Genehmigen-Pill im Header, Einkauf-Sperre bei Entwurf
- [x] Wochenplan-Übersicht (Portrait + Landscape) — Kacheln einheitlich, Label-Positionierung, sessionStorage-Persistenz
- [x] Einkaufsübersicht — nach Senden übersichtliche Ansicht der Artikel im Sheet (Bring + Picnic)
- [x] Deployment-Fix — nixpacks.toml um apt-get Fehler im Nix-Container zu umgehen
