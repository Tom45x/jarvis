---
description: Jarvis-Session sauber abschließen — sichern, aufräumen, Doku/Memory aktualisieren, nächste Session vorbereiten
---

Führe die folgende Abschluss-Routine für dieses Projekt (Jarvis) vollständig und automatisch durch, ohne bei einzelnen Schritten nachzufragen (außer bei echten Unklarheiten). Arbeite die Schritte der Reihe nach ab und fasse am Ende kompakt zusammen, was getan wurde.

## 1. Code-Stand sichern
- `git status` prüfen: alle inhaltlichen Änderungen dieser Session committed? Falls nicht, sinnvoll gruppiert committen (Commit-Message-Konventionen aus `git log` beachten, inkl. der üblichen Co-Authored-By-Zeile).
- `git push origin master` ausführen.
- Verifizieren: `git fetch && git log origin/master..master` muss leer sein. Falls nicht leer → Ursache klären, nicht einfach ignorieren (siehe Lesson vom 2026-09-07: 4 Monate unpushte Commits verhinderten, dass Fixes live gingen).

## 2. `app/tasks/todo.md` aktualisieren
- Neue erledigte Punkte aus dieser Session unter "## Erledigt" ergänzen (kurz, mit Verweis auf relevante Dateien/Commits wo hilfreich).
- Neue offene Punkte/Fragen, die während der Session aufkamen aber nicht erledigt wurden, unter der passenden Sektion ergänzen — nichts nur im Chat-Verlauf "vergraben" lassen.
- Falls sich die Server-Adresse, Coolify-App-UUID oder andere Angaben im Abschnitt "Infrastruktur" geändert haben: dort aktualisieren.
- Prüfen, ob als "offen" geführte Punkte durch die heutige Arbeit tatsächlich bereits erledigt sind (Diskrepanz-Check wie am 2026-09-07 bei "Saftvorschlag + Gesundheitssnack").

## 3. Deployment prüfen (nur falls Code unter `app/` geändert wurde)
- Prüfen, ob die Änderungen bereits live sind, oder ob ein Redeploy nötig ist.
- Aktuelle Server-URL und Coolify-App-UUID aus `app/tasks/todo.md` (Abschnitt "Infrastruktur") nehmen — niemals eine alte, aus dem Gedächtnis bekannte Adresse annehmen.
- Falls kein gültiger Coolify-API-Token griffbereit ist: den Nutzer kurz darauf hinweisen, dass ein Redeploy manuell nötig ist, statt den Schritt stillschweigend zu überspringen.
- Falls Token vorhanden: Redeploy per `GET /api/v1/deploy?uuid=<App-UUID>` anstoßen, Status über `GET /api/v1/deployments/<deployment_uuid>` bis `finished` pollen, Fix stichprobenartig live verifizieren (z.B. per curl gegen die entsprechende API-Route).

## 4. `app/AGENTS.md` ergänzen (nur falls relevant)
- Neue, für künftige Sessions wichtige Architektur-Entscheidungen, Eigenheiten oder Lessons aus dieser Session kurz ergänzen — nur wenn wirklich session-übergreifend relevant, nicht jede Kleinigkeit.

## 5. Memory-System aktualisieren
- Neue Erkenntnisse dieser Session als Memory-Einträge festhalten (Typ `project`/`feedback`/`reference` je nach Inhalt) im Verzeichnis `C:\Users\thoma\.claude\projects\C--Users-thoma-OneDrive-Desktop-CLAUDE-HAUSHALT\memory\`.
- Bestehende Memory-Dateien aktualisieren statt Duplikate anzulegen, falls ein Thema schon existiert (siehe `MEMORY.md`-Index).
- `MEMORY.md`-Index entsprechend ergänzen.
- Keine Secrets/Tokens in Memory-Dateien ablegen (siehe `feedback-keine-secrets-in-docs`).

## 6. Aufräumen
- Kurz prüfen: keine Debug-/Scratch-Dateien versehentlich im Repo committed (temporäre Test-Skripte, Log-Dumps, Screenshots).
- Kurz prüfen: keine Secrets/Tokens im Diff dieser Session (`git diff origin/master master` überfliegen).
- Laufende Hintergrundprozesse dieser Session (z.B. lokal gestartete Dev-Server) beenden, falls noch aktiv.

## 7. Abschluss-Zusammenfassung
Kurze Zusammenfassung an den Nutzer: was wurde in dieser Session erledigt, was ist gepusht/deployed und verifiziert, was bleibt offen für die nächste Session (klar benannt, nicht implizit).
