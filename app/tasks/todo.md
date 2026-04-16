# Jarvis — Todo

## Nächstes Feature
- [ ] **Bring-Update bei Tausch** — Zutaten in den Bring-Listen automatisch aktualisieren wenn ein Gericht getauscht wird

## Offen (Prio ↓)
- [ ] **Saftvorschlag + Gesundheitssnack** (niedrigste Prio) — passende Saft- und Snackvorschläge generieren und in den Wochenplan integrieren
- [ ] Katja & Marie Profile — Lieblingsgerichte, Abneigungen

## Erledigt
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
