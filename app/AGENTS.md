<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Jarvis — Projektüberblick

Familien-Haushalts-App für Wochenplanung: Wochenplan (Gerichte pro Tag/Mahlzeit),
Gerichte-Verwaltung (manuell oder KI-generiert inkl. Zutaten/Rezept), Einkaufsliste
(Bring + Picnic), Extras (Gesundheitssnacks, Saftvorschläge), Instagram-/Chefkoch-
Rezept-Import per iOS-Shortcut.

**Tech-Stack:** Next.js App Router (Turbopack) · Supabase (Projekt "Jarvis Haushalt",
ID `ipsryfhdaugciyzctted`) · Anthropic Claude für alle KI-Features (Wochenplan-
Generierung, Gerichtsvorschläge, Zutaten/Rezept-Generierung, Insta/Chefkoch-Parsing).

**Wo aktueller Stand steht:** `tasks/todo.md` ist die einzige Quelle der Wahrheit
für offene Punkte, Infrastruktur-Adressen (Server-URL, Coolify-UUID) und
Übergabenotizen — dort zuerst nachschauen, nicht in `docs/archiv/` (das ist reine
Bau-Historie, alle dort abgelegten Pläne sind bereits umgesetzt).

## Deployment

App läuft über Coolify auf einem Vultr-Server, erreichbar unter einer
`*.sslip.io`-Adresse. **Diese Adresse ändert sich, wenn der Server migriert wird**
(ist bereits einmal passiert) — aktuelle Adresse und Coolify-App-UUID stehen in
`tasks/todo.md` unter "Infrastruktur", nicht hier fest verankern.

Redeploy: Coolify-API-Token (Keys & Tokens im Dashboard erzeugen, nie im Klartext
committen) + `GET /api/v1/deploy?uuid=<App-UUID>`. Deployment-Status danach über
`GET /api/v1/deployments/<deployment_uuid>` pollen (`status` wird `finished`).

**Kritische Lesson:** Ein Commit, der nicht gepusht wird, geht nie live — Coolify
deployt von `origin/master`, nicht vom lokalen Stand. Nach jedem Fix: committen,
**pushen**, und `git log origin/master..master` prüfen (muss leer sein).

## Sicherheit

Niemals API-Tokens, Bearer-Keys oder Passwörter im Klartext in `docs/`, `tasks/`
oder Code committen — auch nicht in Planungsdokumenten "nur für den internen
Gebrauch". Secrets gehören ausschließlich in `.env.local` (gitignored) bzw. die
Coolify-Umgebungsvariablen.
