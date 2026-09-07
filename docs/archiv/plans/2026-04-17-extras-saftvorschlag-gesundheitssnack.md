# Extras: Saftvorschlag & Gesundheitssnack — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wöchentlich 2 kindgerechte Gesundheitssnacks (Di + Do) und 1 Saftvorschlag (Sa) KI-gestützt generieren, nährstoffoptimiert für Ben (11) und Marie (8), als fixe nicht-tauschbare Karten im Wochenplan anzeigen.

**Architecture:** Claude wählt wöchentlich aus einem kuratierten Katalog (`extras_katalog`) basierend auf dem Nährstoff-Gap der letzten 4 Wochen. Die Auswahl wird in `extras_wochenplan` gespeichert und als 4. Karte pro betroffenen Tag im WochenplanGrid gerendert. Zutaten fließen in die Einkaufsliste.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL), Anthropic SDK (claude-sonnet-4-6), TypeScript, Tailwind CSS

---

## Dateistruktur

**Neu erstellen:**
- `docs/ernaehrung-kinder-referenz.md` — Nährstoffreferenz + Starter-Katalog
- `app/lib/extras.ts` — Katalog laden, Gap-Vektor, Claude-Auswahl
- `app/components/ExtraCard.tsx` — UI-Komponente für Extra-Slots
- `app/app/api/extras/route.ts` — GET extras für einen Plan

**Modifizieren:**
- `app/types/index.ts` — neue Typen: `Naehrstoffe`, `ExtrasKatalogEintrag`, `ExtrasWochenplanEintrag`, `KindProfil`
- `app/app/api/wochenplan/generate/route.ts` — Extras nach Plan generieren + speichern
- `app/components/WochenplanGrid.tsx` — ExtraCard für Di/Do (nach Abend) + Sa (nach Frühstück) rendern
- `app/app/wochenplan/page.tsx` — Extras laden und als Prop übergeben
- `app/lib/einkaufsliste.ts` — Extras-Zutaten in Einkaufsliste aufnehmen
- `app/app/api/einkaufsliste/senden/route.ts` — Extras-Zutaten übergeben

---

## Task 1: Ernährungsreferenz-Datei erstellen

**Files:**
- Create: `docs/ernaehrung-kinder-referenz.md`

- [ ] **Schritt 1: Referenzdatei schreiben**

Erstelle `docs/ernaehrung-kinder-referenz.md` mit folgendem Inhalt:

```markdown
# Ernährungsreferenz: Kinder Ben & Marie

## Kinder-Profile

| | Ben | Marie |
|---|---|---|
| Geburtsdatum | 09.01.2015 | 08.04.2018 |
| Alter | 11 Jahre | 8 Jahre |
| Größe | 146 cm | 130 cm |
| Gewicht | 35 kg | 24 kg |
| Aktivität | sehr aktiv | sehr aktiv |

## DGE-Tagesbedarf (angepasst für sehr aktive Kinder)

Quelle: Deutsche Gesellschaft für Ernährung (DGE), Referenzwerte 2024, erhöht um 15-20% für sehr aktives Sportprogramm.

| Nährstoff | Ben (11 J.) | Marie (8 J.) | Einheit |
|---|---|---|---|
| Protein | 55 | 38 | g |
| Calcium | 1200 | 1000 | mg |
| Eisen | 12 | 10 | mg |
| Zink | 9 | 7 | mg |
| Vitamin A | 900 | 700 | µg |
| Vitamin C | 85 | 75 | mg |
| Vitamin D | 20 | 20 | µg |
| Vitamin K | 50 | 40 | µg |
| Vitamin B1 | 1.2 | 0.9 | mg |
| Vitamin B2 | 1.4 | 1.1 | mg |
| Vitamin B6 | 1.4 | 1.0 | mg |
| Vitamin B12 | 2.0 | 1.8 | µg |
| Folsäure | 300 | 200 | µg |
| Omega-3 | 1.6 | 1.0 | g |
| Magnesium | 320 | 250 | mg |
| Kalium | 3000 | 2600 | mg |

**Erhöhter Bedarf bei Sport:**
- Protein: +15% für Muskelaufbau und Regeneration
- Magnesium: +20% für Muskelkontraktion, verhindert Krämpfe
- Eisen: +10% wegen erhöhtem Sauerstoffbedarf
- Kalium + Natrium: Elektrolyte nach dem Sport

## Kindgerechter Geschmack (geschmacklich, nicht optisch)

**Bitterkeit abmildern:**
- Spinat/Grünkohl im Smoothie: 1 reife Banane + 1 Mango neutralisiert Bitterkeit vollständig
- Rote Beete: mit Apfelsaft oder Orange mischen, Bitterkeit verschwindet fast komplett
- Brokkoli/Kohlrabi: mit Frischkäse-Dip, Bitterkeit wird durch Fett gebunden

**Eigengeschmack reduzieren:**
- Leinsamen/Chia: im Joghurt mit Honig — kaum wahrnehmbar
- Avocado: mit Zitrone und einer Prise Salz — schmiegt sich an andere Aromen
- Hülsenfrüchte (Hummus, Edamame): Salz + Knoblauch + Zitrone macht sie angenehm

**Süße als Brücke:**
- Naturjoghurt: immer mit Honig oder Agavensirup starten, dann langsam reduzieren
- Bittere Säfte: immer 30-40% süße Frucht dazu (Apfel, Mango, Ananas)

## Geräte-Referenz

**Braun Multipack 5 (Entsafter):**
- Ideal für: Äpfel, Karotten, Orangen, Rote Beete, Sellerie, Gurke, Ananas
- Nicht geeignet für: Bananen, Avocado, Beeren (zu weich, verstopfen)
- Ergibt: klaren Saft ohne Fasern

**Philips Pro Blend 6 3D (Mixer):**
- Ideal für: Smoothies mit Banane, Beeren, Mango, Joghurt, Milch, Nüsse
- Kann: Eis zerkleinern, Nüsse mahlen
- Nicht ideal für: sehr harte Karotten oder Rote Beete ohne Flüssigkeit

## Starter-Katalog (Snacks)

### S01 — Apfel-Erdnussbutter
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** Apfel in Scheiben schneiden. Erdnussbutter (naturbelassen, gesüßt) als Dip dazu servieren.
- **Geschmack:** Süße des Apfels übertönt den Nussgeschmack — Kinder essen das fast immer gerne.
- **Portion:** 1 Apfel (ca. 180g) + 2 EL Erdnussbutter (32g)
- **Nährstoffe:** Protein 9g, Calcium 18mg, Eisen 0.9mg, Zink 1.4mg, Vit.A 5µg, Vit.C 10mg, Vit.D 0µg, Vit.K 6µg, B1 0.15mg, B2 0.1mg, B6 0.3mg, B12 0µg, Folsäure 35µg, Omega-3 0.01g, Magnesium 58mg, Kalium 520mg
- **Saison:** ganzjährig

### S02 — Naturjoghurt mit Beeren & Honig
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** 200g Vollmilchjoghurt mit 1 TL Honig verrühren. 80g gemischte Beeren (TK aufgetaut oder frisch) obendrauf.
- **Geschmack:** Honig nimmt dem Joghurt die Säure — Kinder akzeptieren das sehr gut.
- **Portion:** 280g
- **Nährstoffe:** Protein 12g, Calcium 250mg, Eisen 0.5mg, Zink 1.1mg, Vit.A 35µg, Vit.C 20mg, Vit.D 0.1µg, Vit.K 3µg, B1 0.08mg, B2 0.38mg, B6 0.14mg, B12 0.9µg, Folsäure 30µg, Omega-3 0.05g, Magnesium 28mg, Kalium 420mg
- **Saison:** ganzjährig

### S03 — Edamame (gesalzen)
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** TK-Edamame 5 Min kochen, abtropfen, mit grobem Meersalz bestreuen. Aus der Schote pulen und essen.
- **Geschmack:** Salz macht den milden Bohnengeschmack angenehm. Das Pulen ist spielerisch und erhöht Akzeptanz.
- **Portion:** 150g (in der Schote)
- **Nährstoffe:** Protein 11g, Calcium 60mg, Eisen 2.2mg, Zink 1.6mg, Vit.A 9µg, Vit.C 9mg, Vit.D 0µg, Vit.K 26µg, B1 0.15mg, B2 0.08mg, B6 0.1mg, B12 0µg, Folsäure 280µg, Omega-3 0.28g, Magnesium 50mg, Kalium 480mg
- **Saison:** ganzjährig

### S04 — Griechischer Joghurt mit Mango
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** 150g griechischer Joghurt (10% Fett) mit 100g Mangostücken (TK aufgetaut) und 1 TL Honig mischen.
- **Geschmack:** Mango macht den Joghurt tropisch-süß — sehr hohe Kinderakzeptanz.
- **Portion:** 250g
- **Nährstoffe:** Protein 15g, Calcium 190mg, Eisen 0.3mg, Zink 0.9mg, Vit.A 55µg, Vit.C 18mg, Vit.D 0.1µg, Vit.K 2µg, B1 0.06mg, B2 0.25mg, B6 0.16mg, B12 0.7µg, Folsäure 20µg, Omega-3 0.04g, Magnesium 22mg, Kalium 370mg
- **Saison:** ganzjährig

### S05 — Vollkornbrot mit Avocado & Zitrone
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** 1 Scheibe Vollkornbrot toasten. Halbe Avocado mit Gabel zerdrücken, Saft einer halben Zitrone + Prise Salz einrühren. Auf das Brot streichen.
- **Geschmack:** Zitrone und Salz machen die Avocado frisch und angenehm mild.
- **Portion:** 200g
- **Nährstoffe:** Protein 6g, Calcium 25mg, Eisen 1.5mg, Zink 1.0mg, Vit.A 12µg, Vit.C 10mg, Vit.D 0µg, Vit.K 21µg, B1 0.2mg, B2 0.12mg, B6 0.3mg, B12 0µg, Folsäure 95µg, Omega-3 0.12g, Magnesium 45mg, Kalium 680mg
- **Saison:** ganzjährig

### S06 — Cashew-Rosinen-Mix mit Banane
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** 30g gesalzene Cashews + 20g Rosinen in eine Schüssel geben. 1 Banane in Scheiben dazu.
- **Geschmack:** Süße der Rosinen + Banane überdeckt jeden Eigengeschmack der Nüsse.
- **Portion:** 180g
- **Nährstoffe:** Protein 7g, Calcium 22mg, Eisen 2.0mg, Zink 1.8mg, Vit.A 4µg, Vit.C 9mg, Vit.D 0µg, Vit.K 1µg, B1 0.22mg, B2 0.07mg, B6 0.4mg, B12 0µg, Folsäure 28µg, Omega-3 0.02g, Magnesium 88mg, Kalium 700mg
- **Saison:** ganzjährig

### S07 — Hüttenkäse mit Gurke & Dill
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** 150g Hüttenkäse mit etwas Salz und Dill verrühren. Gurke in Scheiben dazu.
- **Geschmack:** Salz und Dill machen Hüttenkäse herzhaft-angenehm, Gurke sorgt für frische Knackigkeit.
- **Portion:** 250g
- **Nährstoffe:** Protein 18g, Calcium 95mg, Eisen 0.2mg, Zink 0.8mg, Vit.A 30µg, Vit.C 5mg, Vit.D 0µg, Vit.K 10µg, B1 0.04mg, B2 0.22mg, B6 0.12mg, B12 0.6µg, Folsäure 18µg, Omega-3 0.1g, Magnesium 15mg, Kalium 220mg
- **Saison:** ganzjährig

### S08 — Hartgekochtes Ei mit Vollkorncräcker
- **Typ:** snack
- **Gerät:** keine
- **Zubereitung:** 2 Eier hart kochen (10 Min), abschrecken, schälen. Mit 4 Vollkorncräckern und etwas Butter servieren.
- **Geschmack:** Butter auf Cräcker + Ei ist sehr vertraut und beliebt bei Kindern.
- **Portion:** 180g
- **Nährstoffe:** Protein 16g, Calcium 65mg, Eisen 2.0mg, Zink 1.6mg, Vit.A 190µg, Vit.C 0mg, Vit.D 3.6µg, Vit.K 1µg, B1 0.1mg, B2 0.4mg, B6 0.2mg, B12 1.8µg, Folsäure 55µg, Omega-3 0.08g, Magnesium 18mg, Kalium 200mg
- **Saison:** ganzjährig

## Starter-Katalog (Säfte)

### J01 — Apfel-Karotten-Ingwer-Saft
- **Typ:** saft
- **Gerät:** entsafter
- **Zubereitung:** 3 Äpfel + 4 Karotten durch den Entsafter laufen lassen. Kleines Stück Ingwer (1cm) dazu. Sofort servieren.
- **Geschmack:** Apfel dominiert den Geschmack — Ingwer ist kaum wahrnehmbar, gibt aber Frische. Karotten schmecken man fast nicht.
- **Portion:** ca. 350ml
- **Nährstoffe:** Protein 1g, Calcium 45mg, Eisen 0.8mg, Zink 0.4mg, Vit.A 890µg, Vit.C 22mg, Vit.D 0µg, Vit.K 18µg, B1 0.08mg, B2 0.06mg, B6 0.18mg, B12 0µg, Folsäure 20µg, Omega-3 0.02g, Magnesium 22mg, Kalium 580mg
- **Saison:** ganzjährig

### J02 — Mango-Orangen-Smoothie
- **Typ:** saft
- **Gerät:** mixer
- **Zubereitung:** 200g TK-Mango + Saft von 2 Orangen (frisch gepresst) + 100ml Wasser in den Mixer. 60 Sekunden auf höchster Stufe.
- **Geschmack:** Sehr süß und fruchtig — hohe Akzeptanz, kein Eigengeschmack.
- **Portion:** ca. 400ml
- **Nährstoffe:** Protein 2g, Calcium 55mg, Eisen 0.5mg, Zink 0.3mg, Vit.A 100µg, Vit.C 110mg, Vit.D 0µg, Vit.K 5µg, B1 0.12mg, B2 0.06mg, B6 0.22mg, B12 0µg, Folsäure 70µg, Omega-3 0.05g, Magnesium 28mg, Kalium 520mg
- **Saison:** ganzjährig

### J03 — Erdbeere-Banane-Vollmilch-Smoothie
- **Typ:** saft
- **Gerät:** mixer
- **Zubereitung:** 200g TK-Erdbeeren + 1 Banane + 200ml Vollmilch + 1 TL Honig in den Mixer. 45 Sekunden mixen.
- **Geschmack:** Klassischer Kinderfavorit — sehr süß, cremig, keine unerwünschten Geschmäcker.
- **Portion:** ca. 450ml
- **Nährstoffe:** Protein 9g, Calcium 280mg, Eisen 1.0mg, Zink 1.0mg, Vit.A 60µg, Vit.C 65mg, Vit.D 0.6µg, Vit.K 4µg, B1 0.14mg, B2 0.4mg, B6 0.3mg, B12 0.9µg, Folsäure 45µg, Omega-3 0.08g, Magnesium 48mg, Kalium 760mg
- **Saison:** ganzjährig

### J04 — Apfel-Rote-Beete-Zitrone
- **Typ:** saft
- **Gerät:** entsafter
- **Zubereitung:** 3 Äpfel + 1 kleine Rote Beete (roh, geschält) + 1/2 Zitrone (geschält) durch den Entsafter.
- **Geschmack:** Apfel übertönt die Rote Beete fast vollständig. Zitrone gibt Frische. Farbe ist eindrucksvoll lila — macht Kinder neugierig.
- **Portion:** ca. 300ml
- **Nährstoffe:** Protein 2g, Calcium 30mg, Eisen 1.8mg, Zink 0.5mg, Vit.A 4µg, Vit.C 25mg, Vit.D 0µg, Vit.K 1µg, B1 0.06mg, B2 0.04mg, B6 0.12mg, B12 0µg, Folsäure 110µg, Omega-3 0.01g, Magnesium 28mg, Kalium 620mg
- **Saison:** ganzjährig

### J05 — Ananas-Karotten-Kurkuma-Saft
- **Typ:** saft
- **Gerät:** entsafter
- **Zubereitung:** 1/4 Ananas (ohne Schale, in Stücken) + 3 Karotten durch den Entsafter. Prise Kurkuma einrühren.
- **Geschmack:** Ananas macht den Saft tropisch-süß. Kurkuma kaum wahrnehmbar, gibt goldene Farbe.
- **Portion:** ca. 320ml
- **Nährstoffe:** Protein 1g, Calcium 42mg, Eisen 0.9mg, Zink 0.4mg, Vit.A 750µg, Vit.C 35mg, Vit.D 0µg, Vit.K 12µg, B1 0.12mg, B2 0.06mg, B6 0.2mg, B12 0µg, Folsäure 30µg, Omega-3 0.02g, Magnesium 30mg, Kalium 540mg
- **Saison:** ganzjährig

### J06 — Beeren-Joghurt-Smoothie
- **Typ:** saft
- **Gerät:** mixer
- **Zubereitung:** 150g gemischte TK-Beeren + 150g Naturjoghurt + 100ml Apfelsaft + 1 TL Honig mixen (60 Sek.).
- **Geschmack:** Apfelsaft und Honig nehmen Säure der Beeren — cremiger, milder Geschmack.
- **Portion:** ca. 400ml
- **Nährstoffe:** Protein 7g, Calcium 195mg, Eisen 0.8mg, Zink 0.8mg, Vit.A 20µg, Vit.C 35mg, Vit.D 0.1µg, Vit.K 15µg, B1 0.07mg, B2 0.28mg, B6 0.12mg, B12 0.6µg, Folsäure 28µg, Omega-3 0.08g, Magnesium 22mg, Kalium 440mg
- **Saison:** ganzjährig
```

- [ ] **Schritt 2: Committen**

```bash
git add docs/ernaehrung-kinder-referenz.md
git commit -m "docs: Ernährungsreferenz für Ben & Marie mit Starter-Katalog"
```

---

## Task 2: Supabase-Tabellen erstellen

**Files:**
- Modify: Supabase-Datenbank (via Dashboard SQL Editor)

- [ ] **Schritt 1: SQL in Supabase Dashboard ausführen**

Öffne Supabase Dashboard → SQL Editor → neues Query. Führe diesen SQL aus:

```sql
-- Tabelle 1: extras_katalog
CREATE TABLE extras_katalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  typ text NOT NULL CHECK (typ IN ('snack', 'saft')),
  name text NOT NULL,
  zubereitung text NOT NULL DEFAULT '',
  geraet text NOT NULL DEFAULT 'keine' CHECK (geraet IN ('entsafter', 'mixer', 'keine')),
  naehrstoffe jsonb NOT NULL DEFAULT '{}',
  zutaten jsonb NOT NULL DEFAULT '[]',
  portion_g integer NOT NULL DEFAULT 200,
  saison integer[] NOT NULL DEFAULT '{}',
  geschmacks_hinweis text NOT NULL DEFAULT ''
);

-- Tabelle 2: extras_wochenplan
CREATE TABLE extras_wochenplan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wochenplan_id uuid NOT NULL REFERENCES wochenplaene(id) ON DELETE CASCADE,
  katalog_id uuid REFERENCES extras_katalog(id),
  typ text NOT NULL CHECK (typ IN ('snack', 'saft')),
  tag text NOT NULL CHECK (tag IN ('dienstag', 'donnerstag', 'samstag')),
  name text NOT NULL,
  begruendung text NOT NULL DEFAULT '',
  naehrstoffe_snapshot jsonb NOT NULL DEFAULT '{}',
  ist_neu boolean NOT NULL DEFAULT false,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);

-- Tabelle 3: kinder_naehrstoff_profil
CREATE TABLE kinder_naehrstoff_profil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  geburtsdatum date NOT NULL,
  groesse_cm integer NOT NULL,
  gewicht_kg numeric(5,1) NOT NULL,
  aktivitaetslevel text NOT NULL DEFAULT 'sehr_aktiv' CHECK (aktivitaetslevel IN ('normal', 'aktiv', 'sehr_aktiv')),
  tagesbedarf jsonb NOT NULL DEFAULT '{}'
);
```

- [ ] **Schritt 2: Kinder-Profile seeden**

```sql
INSERT INTO kinder_naehrstoff_profil (name, geburtsdatum, groesse_cm, gewicht_kg, aktivitaetslevel, tagesbedarf) VALUES
('Ben', '2015-01-09', 146, 35.0, 'sehr_aktiv', '{
  "protein_g": 55, "calcium_mg": 1200, "eisen_mg": 12, "zink_mg": 9,
  "vitamin_a_µg": 900, "vitamin_c_mg": 85, "vitamin_d_µg": 20, "vitamin_k_µg": 50,
  "vitamin_b1_mg": 1.2, "vitamin_b2_mg": 1.4, "vitamin_b6_mg": 1.4, "vitamin_b12_µg": 2.0,
  "folsaeure_µg": 300, "omega3_g": 1.6, "magnesium_mg": 320, "kalium_mg": 3000
}'),
('Marie', '2018-04-08', 130, 24.0, 'sehr_aktiv', '{
  "protein_g": 38, "calcium_mg": 1000, "eisen_mg": 10, "zink_mg": 7,
  "vitamin_a_µg": 700, "vitamin_c_mg": 75, "vitamin_d_µg": 20, "vitamin_k_µg": 40,
  "vitamin_b1_mg": 0.9, "vitamin_b2_mg": 1.1, "vitamin_b6_mg": 1.0, "vitamin_b12_µg": 1.8,
  "folsaeure_µg": 200, "omega3_g": 1.0, "magnesium_mg": 250, "kalium_mg": 2600
}');
```

- [ ] **Schritt 3: Starter-Katalog seeden**

```sql
-- Snacks
INSERT INTO extras_katalog (typ, name, zubereitung, geraet, naehrstoffe, zutaten, portion_g, saison, geschmacks_hinweis) VALUES
('snack', 'Apfel-Erdnussbutter', 'Apfel in Scheiben schneiden. Erdnussbutter als Dip servieren.', 'keine',
 '{"protein_g":9,"calcium_mg":18,"eisen_mg":0.9,"zink_mg":1.4,"vitamin_a_µg":5,"vitamin_c_mg":10,"vitamin_d_µg":0,"vitamin_k_µg":6,"vitamin_b1_mg":0.15,"vitamin_b2_mg":0.1,"vitamin_b6_mg":0.3,"vitamin_b12_µg":0,"folsaeure_µg":35,"omega3_g":0.01,"magnesium_mg":58,"kalium_mg":520}',
 '[{"name":"Apfel","menge":1,"einheit":"Stück","haltbarkeit_tage":14},{"name":"Erdnussbutter (naturbelassen)","menge":30,"einheit":"g","haltbarkeit_tage":180}]',
 212, '{}', 'Süße des Apfels übertönt den Nussgeschmack — Kinder essen das fast immer gerne.'),

('snack', 'Naturjoghurt mit Beeren & Honig', '200g Joghurt mit 1 TL Honig verrühren. 80g Beeren obendrauf.', 'keine',
 '{"protein_g":12,"calcium_mg":250,"eisen_mg":0.5,"zink_mg":1.1,"vitamin_a_µg":35,"vitamin_c_mg":20,"vitamin_d_µg":0.1,"vitamin_k_µg":3,"vitamin_b1_mg":0.08,"vitamin_b2_mg":0.38,"vitamin_b6_mg":0.14,"vitamin_b12_µg":0.9,"folsaeure_µg":30,"omega3_g":0.05,"magnesium_mg":28,"kalium_mg":420}',
 '[{"name":"Naturjoghurt (Vollmilch)","menge":200,"einheit":"g","haltbarkeit_tage":7},{"name":"gemischte Beeren (TK)","menge":80,"einheit":"g","haltbarkeit_tage":180},{"name":"Honig","menge":10,"einheit":"g","haltbarkeit_tage":730}]',
 280, '{}', 'Honig nimmt dem Joghurt die Säure — Kinder akzeptieren das sehr gut.'),

('snack', 'Edamame gesalzen', 'TK-Edamame 5 Min kochen, abtropfen, mit grobem Meersalz bestreuen.', 'keine',
 '{"protein_g":11,"calcium_mg":60,"eisen_mg":2.2,"zink_mg":1.6,"vitamin_a_µg":9,"vitamin_c_mg":9,"vitamin_d_µg":0,"vitamin_k_µg":26,"vitamin_b1_mg":0.15,"vitamin_b2_mg":0.08,"vitamin_b6_mg":0.1,"vitamin_b12_µg":0,"folsaeure_µg":280,"omega3_g":0.28,"magnesium_mg":50,"kalium_mg":480}',
 '[{"name":"Edamame (TK, in der Schote)","menge":150,"einheit":"g","haltbarkeit_tage":180}]',
 150, '{}', 'Salz macht den milden Bohnengeschmack angenehm. Das Pulen ist spielerisch.'),

('snack', 'Griechischer Joghurt mit Mango', '150g griechischer Joghurt mit 100g Mangostücken und 1 TL Honig mischen.', 'keine',
 '{"protein_g":15,"calcium_mg":190,"eisen_mg":0.3,"zink_mg":0.9,"vitamin_a_µg":55,"vitamin_c_mg":18,"vitamin_d_µg":0.1,"vitamin_k_µg":2,"vitamin_b1_mg":0.06,"vitamin_b2_mg":0.25,"vitamin_b6_mg":0.16,"vitamin_b12_µg":0.7,"folsaeure_µg":20,"omega3_g":0.04,"magnesium_mg":22,"kalium_mg":370}',
 '[{"name":"Griechischer Joghurt (10% Fett)","menge":150,"einheit":"g","haltbarkeit_tage":10},{"name":"Mango (TK)","menge":100,"einheit":"g","haltbarkeit_tage":180},{"name":"Honig","menge":10,"einheit":"g","haltbarkeit_tage":730}]',
 250, '{}', 'Mango macht den Joghurt tropisch-süß — sehr hohe Kinderakzeptanz.'),

('snack', 'Vollkornbrot mit Avocado', '1 Scheibe Vollkornbrot toasten. Avocado mit Zitronensaft und Salz zerdrücken und aufstreichen.', 'keine',
 '{"protein_g":6,"calcium_mg":25,"eisen_mg":1.5,"zink_mg":1.0,"vitamin_a_µg":12,"vitamin_c_mg":10,"vitamin_d_µg":0,"vitamin_k_µg":21,"vitamin_b1_mg":0.2,"vitamin_b2_mg":0.12,"vitamin_b6_mg":0.3,"vitamin_b12_µg":0,"folsaeure_µg":95,"omega3_g":0.12,"magnesium_mg":45,"kalium_mg":680}',
 '[{"name":"Vollkornbrot","menge":60,"einheit":"g","haltbarkeit_tage":5},{"name":"Avocado","menge":100,"einheit":"g","haltbarkeit_tage":3},{"name":"Zitrone","menge":0.5,"einheit":"Stück","haltbarkeit_tage":14}]',
 200, '{}', 'Zitrone und Salz machen die Avocado frisch und angenehm mild.'),

('snack', 'Cashew-Rosinen-Mix mit Banane', '30g gesalzene Cashews + 20g Rosinen in Schüssel. 1 Banane in Scheiben dazu.', 'keine',
 '{"protein_g":7,"calcium_mg":22,"eisen_mg":2.0,"zink_mg":1.8,"vitamin_a_µg":4,"vitamin_c_mg":9,"vitamin_d_µg":0,"vitamin_k_µg":1,"vitamin_b1_mg":0.22,"vitamin_b2_mg":0.07,"vitamin_b6_mg":0.4,"vitamin_b12_µg":0,"folsaeure_µg":28,"omega3_g":0.02,"magnesium_mg":88,"kalium_mg":700}',
 '[{"name":"Cashews (gesalzen)","menge":30,"einheit":"g","haltbarkeit_tage":60},{"name":"Rosinen","menge":20,"einheit":"g","haltbarkeit_tage":180},{"name":"Banane","menge":1,"einheit":"Stück","haltbarkeit_tage":4}]',
 180, '{}', 'Süße der Rosinen und Banane überdeckt jeden Eigengeschmack der Nüsse.'),

('snack', 'Hartgekochte Eier mit Vollkorncräckern', '2 Eier 10 Min hart kochen, abschrecken, schälen. Mit 4 Vollkorncräckern servieren.', 'keine',
 '{"protein_g":16,"calcium_mg":65,"eisen_mg":2.0,"zink_mg":1.6,"vitamin_a_µg":190,"vitamin_c_mg":0,"vitamin_d_µg":3.6,"vitamin_k_µg":1,"vitamin_b1_mg":0.1,"vitamin_b2_mg":0.4,"vitamin_b6_mg":0.2,"vitamin_b12_µg":1.8,"folsaeure_µg":55,"omega3_g":0.08,"magnesium_mg":18,"kalium_mg":200}',
 '[{"name":"Eier","menge":2,"einheit":"Stück","haltbarkeit_tage":28},{"name":"Vollkorncräcker","menge":30,"einheit":"g","haltbarkeit_tage":90}]',
 180, '{}', 'Butter auf Cräcker und Ei ist sehr vertraut und beliebt bei Kindern.'),

('snack', 'Hüttenkäse mit Gurke', '150g Hüttenkäse mit Salz und Dill verrühren. Gurke in Scheiben dazu.', 'keine',
 '{"protein_g":18,"calcium_mg":95,"eisen_mg":0.2,"zink_mg":0.8,"vitamin_a_µg":30,"vitamin_c_mg":5,"vitamin_d_µg":0,"vitamin_k_µg":10,"vitamin_b1_mg":0.04,"vitamin_b2_mg":0.22,"vitamin_b6_mg":0.12,"vitamin_b12_µg":0.6,"folsaeure_µg":18,"omega3_g":0.1,"magnesium_mg":15,"kalium_mg":220}',
 '[{"name":"Hüttenkäse","menge":150,"einheit":"g","haltbarkeit_tage":7},{"name":"Gurke","menge":100,"einheit":"g","haltbarkeit_tage":7}]',
 250, '{}', 'Salz und Dill machen Hüttenkäse herzhaft-angenehm.');

-- Säfte
INSERT INTO extras_katalog (typ, name, zubereitung, geraet, naehrstoffe, zutaten, portion_g, saison, geschmacks_hinweis) VALUES
('saft', 'Apfel-Karotten-Ingwer', '3 Äpfel + 4 Karotten durch den Entsafter. Kleines Stück Ingwer (1cm) dazu.', 'entsafter',
 '{"protein_g":1,"calcium_mg":45,"eisen_mg":0.8,"zink_mg":0.4,"vitamin_a_µg":890,"vitamin_c_mg":22,"vitamin_d_µg":0,"vitamin_k_µg":18,"vitamin_b1_mg":0.08,"vitamin_b2_mg":0.06,"vitamin_b6_mg":0.18,"vitamin_b12_µg":0,"folsaeure_µg":20,"omega3_g":0.02,"magnesium_mg":22,"kalium_mg":580}',
 '[{"name":"Äpfel","menge":3,"einheit":"Stück","haltbarkeit_tage":14},{"name":"Karotten","menge":4,"einheit":"Stück","haltbarkeit_tage":14},{"name":"Ingwer","menge":5,"einheit":"g","haltbarkeit_tage":14}]',
 350, '{}', 'Apfel dominiert den Geschmack — Ingwer ist kaum wahrnehmbar, Karotten schmeckt man fast nicht.'),

('saft', 'Mango-Orangen-Smoothie', '200g TK-Mango + Saft von 2 Orangen + 100ml Wasser. 60 Sek. mixen.', 'mixer',
 '{"protein_g":2,"calcium_mg":55,"eisen_mg":0.5,"zink_mg":0.3,"vitamin_a_µg":100,"vitamin_c_mg":110,"vitamin_d_µg":0,"vitamin_k_µg":5,"vitamin_b1_mg":0.12,"vitamin_b2_mg":0.06,"vitamin_b6_mg":0.22,"vitamin_b12_µg":0,"folsaeure_µg":70,"omega3_g":0.05,"magnesium_mg":28,"kalium_mg":520}',
 '[{"name":"Mango (TK)","menge":200,"einheit":"g","haltbarkeit_tage":180},{"name":"Orangen","menge":2,"einheit":"Stück","haltbarkeit_tage":14}]',
 400, '{}', 'Sehr süß und fruchtig — sehr hohe Akzeptanz, kein Eigengeschmack.'),

('saft', 'Erdbeere-Banane-Milch-Smoothie', '200g TK-Erdbeeren + 1 Banane + 200ml Vollmilch + 1 TL Honig. 45 Sek. mixen.', 'mixer',
 '{"protein_g":9,"calcium_mg":280,"eisen_mg":1.0,"zink_mg":1.0,"vitamin_a_µg":60,"vitamin_c_mg":65,"vitamin_d_µg":0.6,"vitamin_k_µg":4,"vitamin_b1_mg":0.14,"vitamin_b2_mg":0.4,"vitamin_b6_mg":0.3,"vitamin_b12_µg":0.9,"folsaeure_µg":45,"omega3_g":0.08,"magnesium_mg":48,"kalium_mg":760}',
 '[{"name":"Erdbeeren (TK)","menge":200,"einheit":"g","haltbarkeit_tage":180},{"name":"Banane","menge":1,"einheit":"Stück","haltbarkeit_tage":4},{"name":"Vollmilch","menge":200,"einheit":"ml","haltbarkeit_tage":5},{"name":"Honig","menge":10,"einheit":"g","haltbarkeit_tage":730}]',
 450, '{}', 'Klassischer Kinderfavorit — sehr süß, cremig, keine unerwünschten Geschmäcker.'),

('saft', 'Apfel-Rote-Beete-Zitrone', '3 Äpfel + 1 kleine Rote Beete (roh, geschält) + halbe Zitrone durch den Entsafter.', 'entsafter',
 '{"protein_g":2,"calcium_mg":30,"eisen_mg":1.8,"zink_mg":0.5,"vitamin_a_µg":4,"vitamin_c_mg":25,"vitamin_d_µg":0,"vitamin_k_µg":1,"vitamin_b1_mg":0.06,"vitamin_b2_mg":0.04,"vitamin_b6_mg":0.12,"vitamin_b12_µg":0,"folsaeure_µg":110,"omega3_g":0.01,"magnesium_mg":28,"kalium_mg":620}',
 '[{"name":"Äpfel","menge":3,"einheit":"Stück","haltbarkeit_tage":14},{"name":"Rote Beete","menge":100,"einheit":"g","haltbarkeit_tage":7},{"name":"Zitrone","menge":0.5,"einheit":"Stück","haltbarkeit_tage":14}]',
 300, '{}', 'Apfel übertönt die Rote Beete fast vollständig. Lila Farbe macht Kinder neugierig.'),

('saft', 'Ananas-Karotten-Kurkuma', '1/4 Ananas (Stücke) + 3 Karotten durch den Entsafter. Prise Kurkuma einrühren.', 'entsafter',
 '{"protein_g":1,"calcium_mg":42,"eisen_mg":0.9,"zink_mg":0.4,"vitamin_a_µg":750,"vitamin_c_mg":35,"vitamin_d_µg":0,"vitamin_k_µg":12,"vitamin_b1_mg":0.12,"vitamin_b2_mg":0.06,"vitamin_b6_mg":0.2,"vitamin_b12_µg":0,"folsaeure_µg":30,"omega3_g":0.02,"magnesium_mg":30,"kalium_mg":540}',
 '[{"name":"Ananas","menge":250,"einheit":"g","haltbarkeit_tage":4},{"name":"Karotten","menge":3,"einheit":"Stück","haltbarkeit_tage":14}]',
 320, '{}', 'Ananas macht den Saft tropisch-süß. Kurkuma kaum wahrnehmbar, gibt goldene Farbe.'),

('saft', 'Beeren-Joghurt-Smoothie', '150g TK-Beeren + 150g Naturjoghurt + 100ml Apfelsaft + 1 TL Honig. 60 Sek. mixen.', 'mixer',
 '{"protein_g":7,"calcium_mg":195,"eisen_mg":0.8,"zink_mg":0.8,"vitamin_a_µg":20,"vitamin_c_mg":35,"vitamin_d_µg":0.1,"vitamin_k_µg":15,"vitamin_b1_mg":0.07,"vitamin_b2_mg":0.28,"vitamin_b6_mg":0.12,"vitamin_b12_µg":0.6,"folsaeure_µg":28,"omega3_g":0.08,"magnesium_mg":22,"kalium_mg":440}',
 '[{"name":"gemischte Beeren (TK)","menge":150,"einheit":"g","haltbarkeit_tage":180},{"name":"Naturjoghurt","menge":150,"einheit":"g","haltbarkeit_tage":7},{"name":"Apfelsaft","menge":100,"einheit":"ml","haltbarkeit_tage":7},{"name":"Honig","menge":10,"einheit":"g","haltbarkeit_tage":730}]',
 400, '{}', 'Apfelsaft und Honig nehmen Säure der Beeren — cremiger, milder Geschmack.');
```

- [ ] **Schritt 3: Kein Commit nötig** (Datenbankänderungen, kein Code)

---

## Task 3: TypeScript-Typen erweitern

**Files:**
- Modify: `app/types/index.ts`

- [ ] **Schritt 1: Neue Typen ans Ende von `app/types/index.ts` anhängen**

```typescript
export interface Naehrstoffe {
  protein_g: number
  calcium_mg: number
  eisen_mg: number
  zink_mg: number
  'vitamin_a_µg': number
  vitamin_c_mg: number
  'vitamin_d_µg': number
  'vitamin_k_µg': number
  vitamin_b1_mg: number
  vitamin_b2_mg: number
  vitamin_b6_mg: number
  'vitamin_b12_µg': number
  'folsaeure_µg': number
  omega3_g: number
  magnesium_mg: number
  kalium_mg: number
}

export interface ExtrasKatalogEintrag {
  id: string
  typ: 'snack' | 'saft'
  name: string
  zubereitung: string
  geraet: 'entsafter' | 'mixer' | 'keine'
  naehrstoffe: Naehrstoffe
  zutaten: Zutat[]
  portion_g: number
  saison: number[]
  geschmacks_hinweis: string
}

export interface ExtrasWochenplanEintrag {
  id: string
  wochenplan_id: string
  katalog_id: string | null
  typ: 'snack' | 'saft'
  tag: 'dienstag' | 'donnerstag' | 'samstag'
  name: string
  begruendung: string
  naehrstoffe_snapshot: Naehrstoffe
  ist_neu: boolean
  erstellt_am: string
}

export interface KindProfil {
  id: string
  name: string
  geburtsdatum: string
  groesse_cm: number
  gewicht_kg: number
  aktivitaetslevel: 'normal' | 'aktiv' | 'sehr_aktiv'
  tagesbedarf: Naehrstoffe
}

export type GapVektor = Record<keyof Naehrstoffe, number>
```

- [ ] **Schritt 2: TypeScript-Fehler prüfen**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Schritt 3: Committen**

```bash
git add app/types/index.ts
git commit -m "feat: Typen für Extras-System (Naehrstoffe, Katalog, Wochenplan, KindProfil)"
```

---

## Task 4: `lib/extras.ts` erstellen

**Files:**
- Create: `app/lib/extras.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase-server'
import { logClaudeNutzung } from '@/lib/claude-tracking'
import type {
  ExtrasKatalogEintrag, ExtrasWochenplanEintrag,
  KindProfil, Naehrstoffe, GapVektor
} from '@/types'

const LEER_NAEHRSTOFFE: Naehrstoffe = {
  protein_g: 0, calcium_mg: 0, eisen_mg: 0, zink_mg: 0,
  'vitamin_a_µg': 0, vitamin_c_mg: 0, 'vitamin_d_µg': 0, 'vitamin_k_µg': 0,
  vitamin_b1_mg: 0, vitamin_b2_mg: 0, vitamin_b6_mg: 0, 'vitamin_b12_µg': 0,
  'folsaeure_µg': 0, omega3_g: 0, magnesium_mg: 0, kalium_mg: 0,
}

export async function ladeExtrasKatalog(): Promise<ExtrasKatalogEintrag[]> {
  const { data, error } = await supabase.from('extras_katalog').select('*')
  if (error) throw error
  return (data ?? []) as ExtrasKatalogEintrag[]
}

export async function ladeKinderProfile(): Promise<KindProfil[]> {
  const { data, error } = await supabase.from('kinder_naehrstoff_profil').select('*')
  if (error) throw error
  return (data ?? []) as KindProfil[]
}

export async function ladeExtrasHistory(wochen = 4): Promise<ExtrasWochenplanEintrag[]> {
  const vonDatum = new Date()
  vonDatum.setDate(vonDatum.getDate() - wochen * 7)

  const { data, error } = await supabase
    .from('extras_wochenplan')
    .select('*')
    .gte('erstellt_am', vonDatum.toISOString())
    .order('erstellt_am', { ascending: false })

  if (error) throw error
  return (data ?? []) as ExtrasWochenplanEintrag[]
}

export async function ladeExtrasForPlan(wochenplanId: string): Promise<ExtrasWochenplanEintrag[]> {
  const { data, error } = await supabase
    .from('extras_wochenplan')
    .select('*')
    .eq('wochenplan_id', wochenplanId)

  if (error) throw error
  return (data ?? []) as ExtrasWochenplanEintrag[]
}

export async function speichereExtras(
  wochenplanId: string,
  extras: Omit<ExtrasWochenplanEintrag, 'id' | 'erstellt_am'>[]
): Promise<ExtrasWochenplanEintrag[]> {
  await supabase.from('extras_wochenplan').delete().eq('wochenplan_id', wochenplanId)

  const { data, error } = await supabase
    .from('extras_wochenplan')
    .insert(extras.map(e => ({ ...e, wochenplan_id: wochenplanId })))
    .select()

  if (error) throw error
  return (data ?? []) as ExtrasWochenplanEintrag[]
}

function addiereNaehrstoffe(a: Naehrstoffe, b: Naehrstoffe): Naehrstoffe {
  return Object.fromEntries(
    (Object.keys(LEER_NAEHRSTOFFE) as (keyof Naehrstoffe)[]).map(k => [k, (a[k] ?? 0) + (b[k] ?? 0)])
  ) as Naehrstoffe
}

export function berechneGapVektor(
  history: ExtrasWochenplanEintrag[],
  profile: KindProfil[]
): GapVektor {
  const gesamtWochenbedarf = profile.reduce((acc, kind) => {
    return addiereNaehrstoffe(acc, Object.fromEntries(
      (Object.keys(kind.tagesbedarf) as (keyof Naehrstoffe)[]).map(k => [k, (kind.tagesbedarf[k] ?? 0) * 7])
    ) as Naehrstoffe)
  }, { ...LEER_NAEHRSTOFFE })

  // Durchschnitt der letzten 4 Wochen gruppiert nach Woche
  const wochenMap = new Map<string, Naehrstoffe>()
  for (const entry of history) {
    const wocheKey = entry.erstellt_am.slice(0, 10)
    const existing = wochenMap.get(wocheKey) ?? { ...LEER_NAEHRSTOFFE }
    wochenMap.set(wocheKey, addiereNaehrstoffe(existing, entry.naehrstoffe_snapshot))
  }

  const geliefertSumme = Array.from(wochenMap.values()).reduce(
    (acc, w) => addiereNaehrstoffe(acc, w),
    { ...LEER_NAEHRSTOFFE }
  )
  const anzahlWochen = Math.max(wochenMap.size, 1)

  const geliefertDurchschnitt = Object.fromEntries(
    (Object.keys(LEER_NAEHRSTOFFE) as (keyof Naehrstoffe)[]).map(k => [k, (geliefertSumme[k] ?? 0) / anzahlWochen])
  ) as Naehrstoffe

  return Object.fromEntries(
    (Object.keys(LEER_NAEHRSTOFFE) as (keyof Naehrstoffe)[]).map(k => {
      const bedarf = gesamtWochenbedarf[k] ?? 1
      const geliefert = geliefertDurchschnitt[k] ?? 0
      const deckung = Math.min(geliefert / bedarf, 1)
      return [k, Math.round((1 - deckung) * 100)]
    })
  ) as GapVektor
}

interface ExtrasGenerierungErgebnis {
  snack_dienstag: { katalog_id: string | null; name: string; begruendung: string; naehrstoffe: Naehrstoffe; ist_neu: boolean }
  snack_donnerstag: { katalog_id: string | null; name: string; begruendung: string; naehrstoffe: Naehrstoffe; ist_neu: boolean }
  saft_samstag: { katalog_id: string | null; name: string; begruendung: string; naehrstoffe: Naehrstoffe; ist_neu: boolean }
}

function mockExtras(katalog: ExtrasKatalogEintrag[]): ExtrasGenerierungErgebnis {
  const snacks = katalog.filter(k => k.typ === 'snack')
  const safte = katalog.filter(k => k.typ === 'saft')
  const snack1 = snacks[0]
  const snack2 = snacks[1] ?? snacks[0]
  const saft = safte[0]
  return {
    snack_dienstag: { katalog_id: snack1?.id ?? null, name: snack1?.name ?? 'Snack', begruendung: 'DEV-Modus', naehrstoffe: snack1?.naehrstoffe ?? { ...LEER_NAEHRSTOFFE }, ist_neu: false },
    snack_donnerstag: { katalog_id: snack2?.id ?? null, name: snack2?.name ?? 'Snack', begruendung: 'DEV-Modus', naehrstoffe: snack2?.naehrstoffe ?? { ...LEER_NAEHRSTOFFE }, ist_neu: false },
    saft_samstag: { katalog_id: saft?.id ?? null, name: saft?.name ?? 'Saft', begruendung: 'DEV-Modus', naehrstoffe: saft?.naehrstoffe ?? { ...LEER_NAEHRSTOFFE }, ist_neu: false },
  }
}

export async function generiereExtras(
  katalog: ExtrasKatalogEintrag[],
  gapVektor: GapVektor,
  history: ExtrasWochenplanEintrag[],
  profile: KindProfil[]
): Promise<ExtrasGenerierungErgebnis> {
  if (process.env.CLAUDE_DEV_MODE === 'true') {
    return mockExtras(katalog)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const aktuellerMonat = new Date().getMonth() + 1

  const letzte4WochenNamen = history.map(e => e.name)
  const katalogJson = JSON.stringify(katalog.map(k => ({
    id: k.id, typ: k.typ, name: k.name, geraet: k.geraet,
    naehrstoffe: k.naehrstoffe, saison: k.saison,
    geschmacks_hinweis: k.geschmacks_hinweis,
    zubereitung: k.zubereitung,
  })))

  const gapText = (Object.keys(gapVektor) as (keyof GapVektor)[])
    .sort((a, b) => (gapVektor[b] ?? 0) - (gapVektor[a] ?? 0))
    .slice(0, 8)
    .map(k => `${k}: ${gapVektor[k]}% Lücke`)
    .join(', ')

  const prompt = `Du bist Jarvis, ein Ernährungsassistent optimiert für Kinder.

Kinderdaten:
${profile.map(p => `- ${p.name}: ${new Date().getFullYear() - new Date(p.geburtsdatum).getFullYear()} Jahre, ${p.gewicht_kg}kg, sehr aktiv`).join('\n')}

Nährstoff-Lücken dieser Woche (je höher der %, desto größer die Lücke):
${gapText}

Aktuelle Saison: Monat ${aktuellerMonat}

In den letzten 4 Wochen verwendet (nicht wiederholen wenn möglich):
${letzte4WochenNamen.join(', ') || 'keine'}

Verfügbarer Katalog (JSON):
${katalogJson}

Wähle 2 Snacks (Dienstag + Donnerstag) und 1 Saft (Samstag):
1. Schließe Items aus, die nicht saisonal passen (saison[] leer = ganzjährig)
2. Bevorzuge Items die die größten Nährstoff-Lücken schließen
3. Vermeide Wiederholungen aus den letzten 4 Wochen
4. Die Kinder mögen keine ungewohnten Geschmäcker — beachte geschmacks_hinweis
5. Snack Di und Do müssen VERSCHIEDEN sein
6. Falls kein Katalog-Item eine Lücke gut abdeckt: erfinde einen neuen Vorschlag (ist_neu: true, katalog_id: null, eigene naehrstoffe schätzen)

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "snack_dienstag": {
    "katalog_id": "uuid-oder-null",
    "name": "Name",
    "begruendung": "max. 60 Zeichen warum dieser Snack",
    "naehrstoffe": { "protein_g": 0, "calcium_mg": 0, "eisen_mg": 0, "zink_mg": 0, "vitamin_a_µg": 0, "vitamin_c_mg": 0, "vitamin_d_µg": 0, "vitamin_k_µg": 0, "vitamin_b1_mg": 0, "vitamin_b2_mg": 0, "vitamin_b6_mg": 0, "vitamin_b12_µg": 0, "folsaeure_µg": 0, "omega3_g": 0, "magnesium_mg": 0, "kalium_mg": 0 },
    "ist_neu": false
  },
  "snack_donnerstag": { ... },
  "saft_samstag": { ... }
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  await logClaudeNutzung('extras', 'claude-sonnet-4-6', message.usage)

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let parsed: ExtrasGenerierungErgebnis
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Ungültige JSON-Antwort von Claude (Extras): ${text.slice(0, 200)}`)
  }

  return parsed
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

Erwartete Ausgabe: keine Fehler

- [ ] **Schritt 3: Committen**

```bash
git add app/lib/extras.ts
git commit -m "feat: lib/extras.ts — Katalog laden, Gap-Vektor, Claude-Auswahl"
```

---

## Task 5: API-Route GET `/api/extras`

**Files:**
- Create: `app/app/api/extras/route.ts`

- [ ] **Schritt 1: Route erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ladeExtrasForPlan } from '@/lib/extras'

export async function GET(req: NextRequest) {
  const wochenplanId = req.nextUrl.searchParams.get('wochenplan_id')
  if (!wochenplanId) {
    return NextResponse.json({ error: 'wochenplan_id fehlt' }, { status: 400 })
  }

  try {
    const extras = await ladeExtrasForPlan(wochenplanId)
    return NextResponse.json(extras)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Schritt 3: Committen**

```bash
git add app/app/api/extras/route.ts
git commit -m "feat: GET /api/extras — Extras für Wochenplan laden"
```

---

## Task 6: `/api/wochenplan/generate` erweitern

**Files:**
- Modify: `app/app/api/wochenplan/generate/route.ts`

- [ ] **Schritt 1: Import ergänzen**

Füge am Anfang der Datei nach den bestehenden Imports hinzu:

```typescript
import {
  ladeExtrasKatalog, ladeKinderProfile, ladeExtrasHistory,
  berechneGapVektor, generiereExtras, speichereExtras
} from '@/lib/extras'
```

- [ ] **Schritt 2: Extras nach Plan generieren**

Ersetze den try-Block in der POST-Funktion: die Zeile `const plan = await speichereWochenplan(alleEintraege, 'entwurf')` und alles danach durch:

```typescript
  const plan = await speichereWochenplan(alleEintraege, 'entwurf')

  // Extras generieren (parallel zum Plan-Speichern)
  try {
    const [katalog, profile, history] = await Promise.all([
      ladeExtrasKatalog(),
      ladeKinderProfile(),
      ladeExtrasHistory(4),
    ])
    const gapVektor = berechneGapVektor(history, profile)
    const ergebnis = await generiereExtras(katalog, gapVektor, history, profile)

    const katalogMap = new Map(katalog.map(k => [k.id, k]))

    await speichereExtras(plan.id, [
      {
        wochenplan_id: plan.id,
        katalog_id: ergebnis.snack_dienstag.katalog_id,
        typ: 'snack',
        tag: 'dienstag',
        name: ergebnis.snack_dienstag.name,
        begruendung: ergebnis.snack_dienstag.begruendung,
        naehrstoffe_snapshot: ergebnis.snack_dienstag.naehrstoffe,
        ist_neu: ergebnis.snack_dienstag.ist_neu,
      },
      {
        wochenplan_id: plan.id,
        katalog_id: ergebnis.snack_donnerstag.katalog_id,
        typ: 'snack',
        tag: 'donnerstag',
        name: ergebnis.snack_donnerstag.name,
        begruendung: ergebnis.snack_donnerstag.begruendung,
        naehrstoffe_snapshot: ergebnis.snack_donnerstag.naehrstoffe,
        ist_neu: ergebnis.snack_donnerstag.ist_neu,
      },
      {
        wochenplan_id: plan.id,
        katalog_id: ergebnis.saft_samstag.katalog_id,
        typ: 'saft',
        tag: 'samstag',
        name: ergebnis.saft_samstag.name,
        begruendung: ergebnis.saft_samstag.begruendung,
        naehrstoffe_snapshot: ergebnis.saft_samstag.naehrstoffe,
        ist_neu: ergebnis.saft_samstag.ist_neu,
      },
    ])
  } catch (extrasErr) {
    console.error('[generate] Extras-Generierung fehlgeschlagen:', extrasErr)
    // Plan trotzdem zurückgeben — Extras sind kein harter Fehler
  }

  return NextResponse.json(plan)
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Schritt 4: Committen**

```bash
git add app/app/api/wochenplan/generate/route.ts
git commit -m "feat: Extras-Generierung in Wochenplan-Generate integriert"
```

---

## Task 7: `ExtraCard`-Komponente erstellen

**Files:**
- Create: `app/components/ExtraCard.tsx`

- [ ] **Schritt 1: Komponente erstellen**

```typescript
'use client'

import type { ExtrasWochenplanEintrag } from '@/types'

interface ExtraCardProps {
  extra: ExtrasWochenplanEintrag
}

export function ExtraCard({ extra }: ExtraCardProps) {
  const istSaft = extra.typ === 'saft'
  const icon = istSaft ? '🥤' : '🥗'
  const label = istSaft ? 'Saftvorschlag' : 'Gesundheitssnack'
  const hintergrund = istSaft ? '#fffbeb' : '#f0fdf4'

  return (
    <div
      className="rounded-2xl px-3 pt-3 pb-2.5 flex flex-col"
      style={{ background: hintergrund, boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex-1">
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-secondary)' }}>
          {label}
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--near-black)' }}>
            {extra.name}
          </p>
          <span className="text-base flex-shrink-0">{icon}</span>
        </div>
        {extra.ist_neu && (
          <span
            className="inline-block text-xs font-semibold mt-1 px-1.5 py-0.5 rounded-full"
            style={{ background: '#ff385c', color: '#fff', fontSize: '10px' }}
          >
            ✦ Neu
          </span>
        )}
      </div>
      {extra.begruendung && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--gray-secondary)' }}>
          {extra.begruendung}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Schritt 3: Committen**

```bash
git add app/components/ExtraCard.tsx
git commit -m "feat: ExtraCard-Komponente für Gesundheitssnack und Saftvorschlag"
```

---

## Task 8: `WochenplanGrid` erweitern

**Files:**
- Modify: `app/components/WochenplanGrid.tsx`

- [ ] **Schritt 1: Import ergänzen**

Füge nach dem letzten bestehenden Import hinzu:

```typescript
import { ExtraCard } from '@/components/ExtraCard'
import type { ExtrasWochenplanEintrag } from '@/types'
```

- [ ] **Schritt 2: Props erweitern**

Ändere das `WochenplanGridProps`-Interface:

```typescript
interface WochenplanGridProps {
  carryOverPlan: Wochenplan | null
  aktiverPlan: Wochenplan | null
  gerichte: Gericht[]
  extras: ExtrasWochenplanEintrag[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onWaehlen: (tag: string, mahlzeit: string, gericht: Gericht) => void
  onRezept: (gericht: Gericht) => void
}
```

- [ ] **Schritt 3: Props in Funktionssignatur aufnehmen**

Ändere die Funktionssignatur:

```typescript
export function WochenplanGrid({ carryOverPlan, aktiverPlan, gerichte, extras, onTauschen, onWaehlen, onRezept }: WochenplanGridProps) {
```

- [ ] **Schritt 4: ExtraCard-Rendering einbauen**

Füge direkt nach dem `useMemo` für `gerichtMap` eine neue `extraMap` hinzu:

```typescript
  const extraMap = useMemo(
    () => {
      const map = new Map<string, ExtrasWochenplanEintrag>()
      for (const e of extras) map.set(e.tag, e)
      return map
    },
    [extras]
  )
```

- [ ] **Schritt 5: ExtraCard im Render-Block einfügen**

Im aktiven Slot-Bereich (im `else`-Block nach CarryOver): Füge nach dem Abend-Block folgende Sektion ein, direkt vor dem schließenden `</>`:

```typescript
                  {/* Extra-Karte: Dienstag + Donnerstag nach Abend, Samstag nach Frühstück */}
                  {slot.tag === 'dienstag' && extraMap.get('dienstag') && (
                    <ExtraCard extra={extraMap.get('dienstag')!} />
                  )}
                  {slot.tag === 'donnerstag' && extraMap.get('donnerstag') && (
                    <ExtraCard extra={extraMap.get('donnerstag')!} />
                  )}
```

Für Samstag: füge nach dem Frühstück-Block (aber vor dem Mittag-Block) ein:

```typescript
                  {/* Saftvorschlag: Samstag nach Frühstück */}
                  {slot.tag === 'samstag' && extraMap.get('samstag') && (
                    <ExtraCard extra={extraMap.get('samstag')!} />
                  )}
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Schritt 7: Committen**

```bash
git add app/components/WochenplanGrid.tsx
git commit -m "feat: WochenplanGrid zeigt ExtraCards für Di/Do/Sa"
```

---

## Task 9: Wochenplan-Page erweitern

**Files:**
- Modify: `app/app/wochenplan/page.tsx`

- [ ] **Schritt 1: Import ergänzen**

Füge nach den bestehenden Imports hinzu:

```typescript
import type { ExtrasWochenplanEintrag } from '@/types'
```

- [ ] **Schritt 2: State für Extras hinzufügen**

Füge nach `const [rezeptGericht, setRezeptGericht] = useState<Gericht | null>(null)` ein:

```typescript
  const [extras, setExtras] = useState<ExtrasWochenplanEintrag[]>([])
```

- [ ] **Schritt 3: Extras laden**

Erweitere den `useEffect` — ersetze den bestehenden Block durch:

```typescript
  useEffect(() => {
    apiFetch('/api/gerichte')
      .then(r => r.json())
      .then(setGerichte)
      .catch(() => setError('Gerichte konnten nicht geladen werden'))
    apiFetch('/api/wochenplan')
      .then(r => r.ok ? r.json() : null)
      .then((data: { carryOverPlan: Wochenplan | null; aktiverPlan: Wochenplan | null } | null) => {
        if (data) {
          setCarryOverPlan(data.carryOverPlan)
          setAktiverPlan(data.aktiverPlan)
          if (data.aktiverPlan?.id) {
            apiFetch(`/api/extras?wochenplan_id=${data.aktiverPlan.id}`)
              .then(r => r.ok ? r.json() : [])
              .then(setExtras)
              .catch(() => {})
          }
        }
      })
      .catch(() => setError('Wochenplan konnte nicht geladen werden'))
  }, [])
```

- [ ] **Schritt 4: Extras nach Generierung laden**

Am Ende der `generieren`-Funktion, nach `setAktiverPlan(data)`:

```typescript
      setAktiverPlan(data)
      if (data?.id) {
        apiFetch(`/api/extras?wochenplan_id=${data.id}`)
          .then(r => r.ok ? r.json() : [])
          .then(setExtras)
          .catch(() => {})
      }
```

- [ ] **Schritt 5: Extras an WochenplanGrid weitergeben**

Ändere den `WochenplanGrid`-Aufruf:

```typescript
        <WochenplanGrid
          carryOverPlan={carryOverPlan}
          aktiverPlan={aktiverPlan}
          gerichte={gerichte}
          extras={extras}
          onTauschen={tauschen}
          onWaehlen={waehlen}
          onRezept={setRezeptGericht}
        />
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Schritt 7: Committen**

```bash
git add app/app/wochenplan/page.tsx
git commit -m "feat: Wochenplan-Page lädt und zeigt Extras"
```

---

## Task 10: Einkaufsliste um Extras-Zutaten erweitern

**Files:**
- Modify: `app/app/api/einkaufsliste/senden/route.ts`

- [ ] **Schritt 1: Import ergänzen**

Füge nach den bestehenden Imports in `senden/route.ts` hinzu:

```typescript
import { ladeExtrasForPlan } from '@/lib/extras'
import type { ExtrasKatalogEintrag } from '@/types'
```

- [ ] **Schritt 2: Extras-Katalog-Loader hinzufügen**

Füge eine neue Hilfsfunktion nach `ladeRegelbedarf` ein:

```typescript
async function ladeExtrasZutaten(wochenplanId: string): Promise<EinkaufsItem[]> {
  const extras = await ladeExtrasForPlan(wochenplanId)
  const katalogIds = extras.map(e => e.katalog_id).filter((id): id is string => id !== null)
  if (katalogIds.length === 0) return []

  const { data } = await supabase
    .from('extras_katalog')
    .select('zutaten')
    .in('id', katalogIds)

  const items: EinkaufsItem[] = []
  for (const row of data ?? []) {
    const zutaten = (row.zutaten ?? []) as Array<{ name: string; menge: number; einheit: string }>
    for (const z of zutaten) {
      items.push({ name: z.name, menge: z.menge, einheit: z.einheit })
    }
  }
  return items
}
```

- [ ] **Schritt 3: Extras-Zutaten in die Einkaufsliste 1 aufnehmen**

Im POST-Handler, nach `const { einkauf1, einkauf2, ausVorrat } = generiereEinkaufslisten(...)`, ergänze:

```typescript
    const extrasZutaten = await ladeExtrasZutaten(plan.id)
    const einkauf1MitExtras = aggregiere([...einkauf1, ...extrasZutaten])
```

Ersetze dann alle Vorkommen von `einkauf1` in `splitNachRouting` durch `einkauf1MitExtras`:

```typescript
    const routing1 = splitNachRouting(einkauf1MitExtras, einstellungen.bringKeywords)
```

- [ ] **Schritt 4: TypeScript prüfen**

```bash
cd app && npx tsc --noEmit
```

- [ ] **Schritt 5: Committen**

```bash
git add app/app/api/einkaufsliste/senden/route.ts
git commit -m "feat: Extras-Zutaten in Einkaufsliste 1 aufgenommen"
```

---

## Task 11: End-to-End testen

- [ ] **Schritt 1: Dev-Server starten**

```bash
cd app && npm run dev
```

- [ ] **Schritt 2: DEV-Modus aktivieren**

Stelle sicher dass in `.env.local` steht:
```
CLAUDE_DEV_MODE=true
```

- [ ] **Schritt 3: Neuen Wochenplan generieren**

Öffne http://localhost:3000/wochenplan → Freitag-Button „Plan für nächste Woche erstellen" klicken.
Erwartung:
- Plan erscheint normal
- Dienstag zeigt Gesundheitssnack-Karte nach Abend
- Donnerstag zeigt Gesundheitssnack-Karte nach Abend
- Samstag zeigt Saftvorschlag-Karte nach Frühstück
- Karten haben Namen + Icon rechts + Begründung „DEV-Modus"

- [ ] **Schritt 4: Einkaufsliste senden**

Plan genehmigen → „Einkaufslisten senden". 
Erwartung: Extras-Zutaten (Äpfel, Joghurt, etc.) erscheinen in der Einkaufsliste.

- [ ] **Schritt 5: Abschluss-Commit**

```bash
git add -A
git commit -m "feat: Saftvorschlag & Gesundheitssnack vollständig implementiert"
```
