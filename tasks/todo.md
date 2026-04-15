# Jarvis — Feature Backlog

## Erledigt ✅

- [x] **5-Sterne-Bewertung** — UI in Gerichte-Seite, Claude priorisiert Favoriten, min. 3 verschiedene pro Woche
- [x] **Trainingstage (Mo/Di/Do Abend)** — programmatisch aus `trainingstage`-Kategorie: Brotzeit, Spiegelei mit Baguette, Baguette mit Aufschnitt
- [x] **Frühstücksbereich** — Mo–Fr Toast, Sa+So programmatisch aus `frühstück`-Kategorie (4 Gerichte)
- [x] **Filmabend (Fr Abend)** — eigene Kategorie: Chicken Wings, Burger, Pizza, McDonalds, Asberger Grill. Bestellgerichte haben "Essen wird bestellt" → kein Einkauf
- [x] **Kategoriebewusstes Tauschen** — Tausch bleibt immer in der richtigen Kategorie (Trainingstage/Filmabend/Frühstück/Normal)
- [x] **Gericht-Vorschläge via Claude** — 3 Ideen inkl. Rezept, direkt hinzufügen
- [x] **Implizites Feedback** — tausch_count, ab 4× sperren, reaktivierbar
- [x] **Bring-Integration** — Wochenplan → Bring-App (2 Listen)
- [x] **Picnic-Integration** — Warenkorb-Befüllung, Split-Logik Picnic/Bring
- [x] **Airbnb Mobile Redesign** — Rausch-Red, #fffbf0 Karten, BottomNav, Thumb-Zone
- [x] **Mobile UX** — Auto-Scroll zu Heute (3 Sek. Verzögerung nach Tausch), iOS Zoom-Prevention, 44px Touch-Targets

## Morgen 📋

- [ ] **Rezepte anzeigen** — Zubereitung/Rezept pro Gericht hinterlegen und auf der Wochenplan- oder Gerichte-Seite anzeigbar machen

## Offen / Nächste Schritte

- [ ] **Picnic Auth-Key** — einmalig `node app/scripts/picnic-auth.mjs` → `PICNIC_AUTH_KEY` in `.env.local`
- [ ] **Katja & Marie Profile** — Lieblingsgerichte, Abneigungen, Lieblingsobst noch leer
- [ ] **Push-Benachrichtigungen** — Wochenplan-Reminder für Katja
