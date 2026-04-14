# Jarvis — Feature Backlog

## Erledigt ✅

- [x] **5-Sterne-Bewertung für Gerichte** — Sterne-UI in Gerichte-Seite, Claude priorisiert 5-Sterne-Favoriten, min. 3 verschiedene pro Woche
- [x] **Brotzeit-Regel / Trainingstage** — Mo, Di, Do abend → automatisch Trainingstage-Kategorie (schnelle Gerichte). Brotzeit, Spiegelei mit Baguette, Baguette mit Aufschnitt in DB
- [x] **Frühstücksbereich** — Mo–Fr fest Toast mit Aufschnitt, Sa+So Claude wählt aus Frühstücks-Kategorie. 4 Wochenend-Frühstücke in DB.
- [x] **Gericht-Vorschläge via Claude** — 3 neue Ideen auf Knopfdruck inkl. Rezept, direkt hinzufügen mit Zutaten-Generierung
- [x] **Implizites Feedback** — tausch_count tracken, ab 4× Tausch Gericht sperren, reaktivierbar in Einstellungen
- [x] **Bring-Integration** — Wochenplan → "Einkaufslisten senden" → Bring-App (2 Listen: Wocheneinkauf + Bens Brotzeit)
- [x] **Picnic-Integration** — Artikel über Picnic API suchen & in Warenkorb legen (Split-Logik: Picnic/Bring nach Keywords + Mindestbestellwert)
- [x] **Airbnb Mobile Redesign** — Komplettes UI-Redesign für Katja (Rausch-Red, Card-Shadow, warm #fffbf0, BottomNav, Thumb-Zone)
- [x] **Mobile UX-Optimierungen** — Auto-Scroll zu Heute, iOS Zoom-Prevention, 44px Touch-Targets, verzögertes Rückscroll (3 Sek.)

## Offen / Nächste Schritte

- [ ] **Picnic Auth-Key einrichten** — `node scripts/picnic-auth.mjs` ausführen, generierten Key als `PICNIC_AUTH_KEY` in `.env.local` eintragen (einmaliger Setup für 2FA)
- [ ] **Katja & Marie Profile ergänzen** — Lieblingsgerichte, Abneigungen, Lieblingsobst für Katja und Marie in DB eintragen
- [ ] **Mehr Frühstücks-Gerichte** — Wochenend-Frühstücke weiter ausbauen (aktuell: Pfannkuchen mit Apfelmus, Englisches Frühstück, Rührerei mit Speck, Apfel-Pfannkuchen)
- [ ] **Push-Benachrichtigungen** — Wochenplan-Reminder für Katja (z.B. "Bitte Plan genehmigen")
