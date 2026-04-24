-- Einkaufsliste v2: Sektionen, Snapshot, Gestrichen, Sync-Fehler

alter table einkaufslisten
  add column if not exists picnic jsonb not null default '[]',
  add column if not exists bring1 jsonb not null default '[]',
  add column if not exists bring2 jsonb not null default '[]',
  add column if not exists aus_vorrat jsonb not null default '[]',
  add column if not exists gestrichen jsonb not null default '[]',
  add column if not exists gesendet_am timestamptz,
  add column if not exists gesendet_snapshot jsonb,
  add column if not exists sync_fehler jsonb;

-- Alte artikel-Spalte (ungenutzt) bleibt bestehen — wird in separater Migration entfernt
-- Unique-Constraint: pro Wochenplan genau eine Liste
create unique index if not exists einkaufslisten_wochenplan_id_unique
  on einkaufslisten(wochenplan_id);
