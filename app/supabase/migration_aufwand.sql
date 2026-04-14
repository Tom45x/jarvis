-- Neue Spalten hinzufügen
ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS aufwand TEXT DEFAULT 'mittel';
ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS haltbarkeit_tage INTEGER DEFAULT 1;

-- Alle Gerichte kategorisieren
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Rösti mit Apfelmus';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Nudeln mit Butter';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Fischstäbchen mit Kartoffeln und Erbsen';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 2 WHERE name = 'Risibisi';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 2 WHERE name = 'Flickerklopse';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Pizza Margherita';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Pfannekuchen';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Raclette';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Wraps';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 2 WHERE name = 'Frikadellen';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 1 WHERE name = 'Steak mit Pommes und Mais';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 2 WHERE name = 'Schweinefilet mit Süßkartoffelpüree';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 2 WHERE name = 'Züricher Geschnetzeltes';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 1 WHERE name = 'Bratwurst mit Kohlrabi und Kartoffelpüree';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 1 WHERE name = 'Bratwurst mit Möhren und Kartoffeln';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Leberkäs';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 2 WHERE name = 'Hühnchenbrust mit Broccoli';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 1 WHERE name = 'Burger und Pommes';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 2 WHERE name = 'Hühnchenbrust mit Mais und Reis';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 1 WHERE name = 'Schnitzel mit Kartoffeln';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 2 WHERE name = 'Gegrillte Bauchscheiben';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Spaghetti mit Garnelen';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 4 WHERE name = 'Spaghetti Bolognese';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 3 WHERE name = 'Lasagne';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Tortellini a la Panna';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 1 WHERE name = 'Maccaroni mit Spinat';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Schinkennudeln';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Spaghetti mit Basilikum Pesto';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 4 WHERE name = 'Möhren-Ingwer-Suppe';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 4 WHERE name = 'Gemüsesuppe';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 5 WHERE name = 'Chili con Carne';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 4 WHERE name = 'Linseneintopf';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 4 WHERE name = 'Weiße Bohnensuppe';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 3 WHERE name = 'Spätzle mit Hühnchen';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 3 WHERE name = 'Zucchini-Hack-Auflauf';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Garnelen';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 1 WHERE name = 'Gegrillte Dorade';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 1 WHERE name = 'Wolfsbarsch';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 1 WHERE name = 'Fisch mit Senfsauce und Kartoffeln';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Salat mit Putenbrust';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Salat mit Ziegenkäse';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 1 WHERE name = 'Salat mit Bratkartoffeln und Spiegelei';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Bauernfrühstück';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 3 WHERE name = 'Massaman Curry';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Bruschetta';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 3 WHERE name = 'Thai Curry';
UPDATE gerichte SET aufwand = 'aufwendig', haltbarkeit_tage = 3 WHERE name = 'Chicken Tikka Masala';
UPDATE gerichte SET aufwand = 'schnell', haltbarkeit_tage = 1 WHERE name = 'Englisches Frühstück';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 1 WHERE name = 'Spinat mit Kartoffeln und Ei';
UPDATE gerichte SET aufwand = 'mittel',  haltbarkeit_tage = 4 WHERE name = 'Hühnersuppe';

-- McDonalds als Freitagsoption hinzufügen (keine Zutaten)
INSERT INTO gerichte (name, zutaten, gesund, kategorie, aufwand, haltbarkeit_tage, quelle)
VALUES ('McDonalds', '{}', false, 'sonstiges', 'schnell', 1, 'manuell')
ON CONFLICT (name) DO NOTHING;

-- Chicken Wings explizit als Freitagsgericht markieren (bereits vorhanden via Seed als Liebling)
-- Freitag-Gerichte sind: Chicken Wings mit Pommes, Burger und Pommes, McDonalds
