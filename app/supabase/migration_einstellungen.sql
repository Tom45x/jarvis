CREATE TABLE IF NOT EXISTS einstellungen (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Standardwerte: Montag (1) und Donnerstag (4)
-- Skala: 1=Montag, 2=Dienstag, 3=Mittwoch, 4=Donnerstag, 5=Freitag, 6=Samstag, 7=Sonntag
INSERT INTO einstellungen (key, value) VALUES ('einkaufstag_1', '1') ON CONFLICT DO NOTHING;
INSERT INTO einstellungen (key, value) VALUES ('einkaufstag_2', '4') ON CONFLICT DO NOTHING;
