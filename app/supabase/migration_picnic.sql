-- Regelbedarf: wöchentliche Standard-Artikel die immer zu Picnic gehen
CREATE TABLE IF NOT EXISTS regelbedarf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  menge NUMERIC NOT NULL,
  einheit TEXT NOT NULL
);

INSERT INTO regelbedarf (name, menge, einheit) VALUES
  ('Toast', 1, 'Packung'),
  ('Milch', 2, 'l'),
  ('Butter', 1, 'Packung'),
  ('Eier', 10, 'Stück')
ON CONFLICT DO NOTHING;

-- Picnic-Einstellungen in bestehende einstellungen-Tabelle
INSERT INTO einstellungen (key, value) VALUES
  ('picnic_mindestbestellwert', '35'),
  ('picnic_bring_keywords', '["Hähnchen","Rind","Schwein","Lachs","Thunfisch","Garnelen","Forelle","Dorade","Wolfsbarsch","Apfel","Birne","Banane","Erdbeere","Tomate","Gurke","Zucchini","Paprika","Brokkoli","Karotte","Möhre","Spinat","Salat","Fenchel","Kohlrabi","Lauch","Zwiebel","Knoblauch"]')
ON CONFLICT (key) DO NOTHING;
