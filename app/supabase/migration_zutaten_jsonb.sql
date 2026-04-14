-- Ändert zutaten von text[] zu jsonb
-- Bestehende leere Arrays {} werden zu einem leeren JSON-Array []
ALTER TABLE gerichte
  ALTER COLUMN zutaten TYPE jsonb
  USING CASE
    WHEN zutaten IS NULL OR array_length(zutaten, 1) IS NULL THEN '[]'::jsonb
    ELSE to_jsonb(zutaten)
  END;

-- Standardwert anpassen
ALTER TABLE gerichte ALTER COLUMN zutaten SET DEFAULT '[]'::jsonb;
