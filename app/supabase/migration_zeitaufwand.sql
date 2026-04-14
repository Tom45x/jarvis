-- Bestehende aufwand-Werte auf konkrete Zeitangaben umstellen
UPDATE gerichte SET aufwand = '15 Min' WHERE aufwand = 'schnell';
UPDATE gerichte SET aufwand = '30 Min' WHERE aufwand = 'mittel';
UPDATE gerichte SET aufwand = '60+ Min' WHERE aufwand = 'aufwendig';
UPDATE gerichte SET aufwand = '30 Min' WHERE aufwand IS NULL OR aufwand = '';
