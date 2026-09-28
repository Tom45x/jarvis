-- Putzplan: abhakbare Haushaltsaufgaben (wöchentlich, monatlich, quartalsweise)
-- Erledigt = Zeile in putz_erledigungen mit dem aktuellen Periodenschlüssel
-- ('2026-W40', '2026-09', '2026-Q3') — neue Periode, Haken automatisch weg.
-- Aufgaben werden per SQL gepflegt, nicht in der App.

CREATE TABLE IF NOT EXISTS putz_aufgaben (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titel        TEXT NOT NULL,
  beschreibung TEXT,
  rhythmus     TEXT NOT NULL CHECK (rhythmus IN ('woche', 'monat', 'quartal')),
  -- Skala wie in einstellungen: 1=Montag … 7=Sonntag; NULL bei quartal
  wochentag    INT CHECK (wochentag BETWEEN 1 AND 7),
  sortierung   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS putz_erledigungen (
  aufgabe_id  UUID NOT NULL REFERENCES putz_aufgaben(id) ON DELETE CASCADE,
  periode     TEXT NOT NULL,
  erledigt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (aufgabe_id, periode)
);

-- Wie alle Tabellen: RLS an, Zugriff nur serverseitig über den Service-Role-Key
ALTER TABLE putz_aufgaben ENABLE ROW LEVEL SECURITY;
ALTER TABLE putz_erledigungen ENABLE ROW LEVEL SECURITY;

-- Startliste aus Katjas handschriftlichem Plan (Beschreibungen aus der Canva-Vorlage)
INSERT INTO putz_aufgaben (titel, beschreibung, rhythmus, wochentag, sortierung) VALUES
  -- Wöchentlich
  ('Bad: Waschbecken reinigen',            NULL, 'woche', 1, 10),
  ('Bad: Armaturen reinigen',              NULL, 'woche', 1, 11),
  ('Bad: Dusche reinigen',                 'Duschkabine/Duschtür und die Armaturen der Dusche', 'woche', 1, 12),
  ('Bad: WC reinigen',                     NULL, 'woche', 1, 13),
  ('Mülleimer leeren',                     'Kleine Mülleimer im Bad/WC, Büro usw.', 'woche', 1, 14),
  ('Wohnbereich: Oberflächen abstauben',   NULL, 'woche', 2, 20),
  ('Flur',                                 NULL, 'woche', 2, 21),
  ('Pflanzen',                             NULL, 'woche', 3, 30),
  ('Treppe',                               NULL, 'woche', 3, 31),
  ('Küche: Herd',                          NULL, 'woche', 4, 40),
  ('Küche: Fronten',                       NULL, 'woche', 4, 41),
  ('Küche: Spüle',                         NULL, 'woche', 4, 42),
  ('Kühlschrank ausmisten',                NULL, 'woche', 4, 43),
  ('Schlafzimmer: Staub wischen',          'Oberflächen', 'woche', 5, 50),
  ('Kinderzimmer: Staub wischen',          'Oberflächen', 'woche', 5, 51),
  -- Monatlich
  ('Mülleimer Küche gründlich reinigen',   'Korpus und Inlett gründlich reinigen', 'monat', 1, 110),
  ('Türklinken',                           NULL, 'monat', 2, 120),
  ('Lichtschalter',                        NULL, 'monat', 2, 121),
  ('Auto reinigen',                        NULL, 'monat', 3, 130),
  ('Backofen',                             NULL, 'monat', 4, 140),
  ('Küche: Fronten',                       NULL, 'monat', 4, 141),
  ('Kühlschrank auswischen',               NULL, 'monat', 4, 142),
  ('Betten beziehen',                      NULL, 'monat', 5, 150),
  -- Quartal
  ('Waschmaschine reinigen',               NULL, 'quartal', NULL, 200),
  ('Spülmaschine reinigen',                NULL, 'quartal', NULL, 201),
  ('Kaffeemaschine reinigen',              NULL, 'quartal', NULL, 202),
  ('Waschküche',                           NULL, 'quartal', NULL, 203),
  ('Fenster putzen',                       NULL, 'quartal', NULL, 204),
  ('Heizkörper reinigen',                  NULL, 'quartal', NULL, 205),
  ('Schubladen ausmisten: Küche',          'Ausmisten, neu sortieren', 'quartal', NULL, 206),
  ('Schubladen ausmisten: Bad',            'Ausmisten, neu sortieren', 'quartal', NULL, 207),
  ('Schubladen ausmisten: Schlafzimmer',   'Ausmisten, neu sortieren', 'quartal', NULL, 208),
  ('Schubladen ausmisten: Kinderzimmer',   'Ausmisten, neu sortieren', 'quartal', NULL, 209);
