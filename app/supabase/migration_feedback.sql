ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS tausch_count INT DEFAULT 0;
ALTER TABLE gerichte ADD COLUMN IF NOT EXISTS gesperrt BOOLEAN DEFAULT FALSE;

-- Sicherheitsnetz für bestehende Zeilen
UPDATE gerichte SET tausch_count = 0 WHERE tausch_count IS NULL;
UPDATE gerichte SET gesperrt = false WHERE gesperrt IS NULL;
