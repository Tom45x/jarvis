-- Migration: claude_nutzung Tabelle
-- Executed: 2026-04-16
-- Purpose: Tracking von Claude API Calls (Operation, Modell, Tokens, Kosten)

CREATE TABLE IF NOT EXISTS claude_nutzung (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erstellt_am   timestamptz NOT NULL DEFAULT now(),
  operation     text NOT NULL,
  modell        text NOT NULL,
  input_tokens  int4 NOT NULL,
  output_tokens int4 NOT NULL,
  kosten_usd    numeric(10,6) NOT NULL
);
