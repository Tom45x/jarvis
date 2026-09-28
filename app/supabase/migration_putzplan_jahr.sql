-- Putzplan: Rhythmus 'jahr' + Abgleich mit Katjas Reinschrift (Scans _0001/_0002)
-- Periodenschlüssel für 'jahr' ist die Jahreszahl ('2026').

ALTER TABLE putz_aufgaben DROP CONSTRAINT putz_aufgaben_rhythmus_check;
ALTER TABLE putz_aufgaben ADD CONSTRAINT putz_aufgaben_rhythmus_check
  CHECK (rhythmus IN ('woche', 'monat', 'quartal', 'jahr'));

UPDATE putz_aufgaben SET titel = 'Wohn-/Essbereich: Oberflächen abstauben'
  WHERE titel = 'Wohnbereich: Oberflächen abstauben';
UPDATE putz_aufgaben SET titel = 'Auto waschen'
  WHERE titel = 'Auto reinigen';
UPDATE putz_aufgaben SET beschreibung = 'inkl. Nachttisch'
  WHERE titel = 'Betten beziehen';

-- Auf der Reinschrift durchgestrichen
DELETE FROM putz_aufgaben WHERE titel = 'Fenster putzen' AND rhythmus = 'quartal';

INSERT INTO putz_aufgaben (titel, beschreibung, rhythmus, wochentag, sortierung) VALUES
  ('Dunstabzugshaube reinigen',           NULL, 'quartal', NULL, 203),
  ('Keller aussortieren',                 NULL, 'jahr',    NULL, 300),
  ('Kinderzimmer aussortieren',           NULL, 'jahr',    NULL, 301),
  ('Kleiderschränke oben aussortieren',   NULL, 'jahr',    NULL, 302);
