-- Eine neue Spalte: Original-URL des Insta-Reels (Dedup-Key)
ALTER TABLE gerichte
  ADD COLUMN IF NOT EXISTS quelle_url TEXT;

-- Partial Unique-Index: Dedup greift nur, wenn URL gesetzt ist.
-- Bestehende Gerichte (alle quelle_url=NULL) kollidieren nicht.
CREATE UNIQUE INDEX IF NOT EXISTS gerichte_quelle_url_unique
  ON gerichte (quelle_url)
  WHERE quelle_url IS NOT NULL;

-- Rollback (manuell, falls jemals nötig):
--   DROP INDEX IF EXISTS gerichte_quelle_url_unique;
--   ALTER TABLE gerichte DROP COLUMN IF EXISTS quelle_url;
