# Jarvis — Todo

## Blockiert — Chefkoch-Import fertig, wartet auf Produktiv-Setup
Code ist fertig, getestet und committed (Commits `18fbf2d`, `3f54286` auf `master`,
2026-08-24). Es fehlt nur noch die Produktiv-Konfiguration:

- [ ] **`CHEFKOCH_IMPORT_TOKEN` in Coolify setzen** — Wert liegt lokal in
      `.env.local` (letzte Zeile, `CHEFKOCH_IMPORT_TOKEN=...`).
      Coolify-API-Zugangsdaten (Bearer-Token, App-UUID, Host) stehen in
      `docs/superpowers/plans/2026-04-16-claude-tracking.md` — bewusst nicht
      hier nochmal im Klartext wiederholt. Env-Var per
      `POST /api/v1/applications/{uuid}/envs` mit Body
      `{"key":"CHEFKOCH_IMPORT_TOKEN","value":"<Wert aus .env.local>"}` setzen.
- [ ] **Redeploy anstoßen**, damit Coolify die neue Env-Var lädt:
      `POST /api/v1/applications/{uuid}/restart`
- [ ] **iOS-Shortcut „An Jarvis senden (Chefkoch)"** bauen — Kopie des bestehenden
      Insta-Shortcuts, Ziel-URL `https://<domain>/api/chefkoch/import`, Token wie oben.

**Warum das noch nicht erledigt ist:** Am 2026-08-24 war `140.82.38.192` (Vultr,
Frankfurt, AS20473) von Thomas' Telekom-Anschluss (Moers) aus komplett
unerreichbar — Traceroute bricht direkt nach der Übergabe an GTT Communications
(`ae1.cr7-fra2.ip4.gtt.net`) ohne jede Antwort ab, klassisches Bild einer
Transit-Überlastung/Blackhole auf der Strecke Telekom↔GTT↔Vultr, kein
Firewall-/Config-Problem auf unserer Seite. Der Server selbst lief normal
(vom Handy aus erreichbar). Workaround: über Mobilfunk-Hotspot oder VPN
nochmal versuchen. Für `curl` gegen diesen Host ist in
`.claude/settings.local.json` bereits eine Permission-Regel
(`Bash(curl:*140.82.38.192:8000*)`) hinterlegt.

## Nächstes Feature
- [ ] **Bring-Update bei Tausch** — Zutaten in den Bring-Listen automatisch aktualisieren wenn ein Gericht getauscht wird

## Offen (Prio ↓)
- [ ] **Saftvorschlag + Gesundheitssnack** (niedrigste Prio) — passende Saft- und Snackvorschläge generieren und in den Wochenplan integrieren
- [ ] Katja & Marie Profile — Lieblingsgerichte, Abneigungen

## Erledigt
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
