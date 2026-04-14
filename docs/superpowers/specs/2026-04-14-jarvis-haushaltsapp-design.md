# Jarvis – Haushaltsapp: Design Spec
**Datum:** 2026-04-14  
**Status:** Genehmigt

---

## 1. Ziel & Kontext

Jarvis ist eine Haushaltsapp für die Familie, primär genutzt von Katja über ihr iPhone 16. Der Fokus liegt auf der wöchentlichen Ernährungsplanung für die Kinder (Ben, 11 Jahre; Tochter, 8 Jahre) und die Eltern, sowie der automatischen Erstellung und Verteilung von Einkaufslisten auf Picnic (Lieferung) und Bring (selbst einkaufen).

Jarvis kombiniert ein strukturiertes UI mit einem eingebetteten Chat-Interface (natürliche Sprache).

---

## 2. Technologie-Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14 (PWA) + Tailwind CSS |
| Hosting | Vercel (kostenloser Tier für Start) |
| KI | Claude API (`claude-sonnet-4-6`) |
| Datenbank | Supabase (Postgres) |
| Einkauf 1 | Bring API (offiziell) |
| Einkauf 2 | Picnic inoffizielle Community-API |
| Rezepte | TheMealDB API (kostenlos) |

**Deployment-Phasen:**
- **Phase 1 (lokal/testen):** App läuft lokal, KI-Logik wird direkt über Claude Code im Terminal prototypisiert — kein API-Key nötig
- **Phase 2 (produktiv):** Claude API eingebaut, Deployment auf Vercel, Katja nutzt Jarvis über iPhone

---

## 3. Kernfunktionen (MVP)

### 3.1 Wochenplaner
- Jarvis generiert jeden Montag automatisch einen 7-Tage-Essensplan (Mittag + Abend)
- Basis: Familienprofile (Lieblingsgerichte, Abneigungen, Altersgruppen)
- Balance: ~70% bekannte Lieblingsgerichte, ~30% gesündere Alternativen
- Extra-Sektion: Saft- und Drink-Vorschläge für den Entsafter
- Katja sieht den Plan in einer Mo–So Übersicht und kann per Tap oder Chat einzelne Gerichte austauschen
- Nach Genehmigung wird die Einkaufsliste automatisch generiert

### 3.2 Gerichtevorschläge & Lernlogik (Hybrid-Ansatz)
- **Bekannte Gerichte:** Startet mit der manuell gepflegten Familiendatenbank (aus den Profildateien in `familie/`)
- **Neue Vorschläge:** Jarvis schlägt 1x pro Woche ein neues Gericht vor, das per TheMealDB API recherchiert und durch Claude nach Geschmacksprofil gefiltert wird
- Katja kann neue Gerichte annehmen (→ wandern in Supabase) oder ablehnen
- Jarvis lernt über Zeit: je mehr Feedback, desto besser die Vorschläge
- Alle Gerichte werden auf Deutsch präsentiert, Zutatenlisten automatisch angepasst

### 3.3 Einkaufsliste & Routing
- Aus dem genehmigten Wochenplan generiert Jarvis eine vollständige Einkaufsliste
- Claude entscheidet pro Artikel: **Picnic** (Lieferung) oder **Bring** (selbst kaufen)
  - Entscheidungslogik: Verfügbarkeit bei Picnic, nächster Liefertag, Frische-Anforderung
- Mit einem Tap überträgt Katja die Bring-Liste direkt in ihre Bring-App (offizielle API)
- Die Picnic-Bestellung wird zur Prüfung vorgelegt, bevor sie abgeschickt wird (inoffizielle API — mit Hinweis auf Stabilitätsrisiko)

### 3.4 Chat-Interface
- Eingebetteter Chat auf jeder Seite
- Beispiel-Befehle: "Tausch Mittwochabend aus", "Ben mag diese Woche keinen Brokkoli", "Was haben wir letzte Woche gegessen?"
- Jarvis merkt sich Feedback und berücksichtigt es bei künftigen Plänen

### 3.5 Haushalt (Phase 2, niedrige Prio)
- Putzplan erstellen und verwalten
- Terminerinnerungen: Ben Training, Tochter von Grundschule abholen
- Weitere Haushaltshilfen nach Bedarf

---

## 4. Datenmodell (Supabase)

| Tabelle | Felder |
|---|---|
| `familie_profile` | id, name, alter, lieblingsgerichte[], abneigungen[], notizen |
| `gerichte` | id, name, zutaten[], gesund (bool), beliebtheit_per_person (json), quelle (manuell/TheMealDB) |
| `wochenplaene` | id, woche_start, eintraege (json: tag → gericht_id), status (entwurf/genehmigt) |
| `einkaufslisten` | id, wochenplan_id, artikel[], routing (picnic/bring), status |
| `feedback` | id, gericht_id, person_id, bewertung, kommentar, datum |

---

## 5. Onboarding

Beim ersten Start liest Jarvis die Profildateien aus `familie/` (thomas.md, katja.md, ben.md, tochter.md) und befüllt damit die Supabase-Datenbank. Danach läuft alles automatisch. Die Markdown-Dateien dienen als einfach editierbare Wissensbasis.

---

## 6. Ordnerstruktur

```
Jarvis/
├── familie/              # Geschmacksprofile (Markdown)
│   ├── thomas.md
│   ├── katja.md
│   ├── ben.md
│   └── tochter.md
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-14-jarvis-haushaltsapp-design.md
├── app/                  # Next.js App (wird angelegt bei Implementierung)
└── tasks/                # Implementierungspläne & Fortschritt
```

---

## 7. Offene Punkte / Risiken

- **Picnic API:** Inoffizielle Community-API — funktioniert aktuell, aber Picnic könnte sie sperren. Fallback: Picnic-Liste als exportierbarer Link.
- **Tochters Name:** Noch nicht eingetragen in `familie/tochter.md` — vor Implementierung ergänzen.
- **Bring API Zugang:** Credentials müssen einmalig eingerichtet werden.
