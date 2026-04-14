-- Familienmitglieder
create table familie_profile (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  alter integer,
  lieblingsgerichte text[] default '{}',
  abneigungen text[] default '{}',
  lieblingsobst text[] default '{}',
  lieblingsgemuese text[] default '{}',
  notizen text default '',
  erstellt_am timestamptz default now()
);

-- Gerichte
create table gerichte (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  zutaten text[] default '{}',
  gesund boolean default false,
  kategorie text not null default 'sonstiges',
  beliebtheit jsonb default '{}',
  quelle text default 'manuell',
  erstellt_am timestamptz default now()
);

-- Wochenpläne
create table wochenplaene (
  id uuid primary key default gen_random_uuid(),
  woche_start date not null unique,
  eintraege jsonb not null default '[]',
  status text not null default 'entwurf',
  erstellt_am timestamptz default now()
);

-- Einkaufslisten
create table einkaufslisten (
  id uuid primary key default gen_random_uuid(),
  wochenplan_id uuid references wochenplaene(id),
  artikel jsonb not null default '[]',
  erstellt_am timestamptz default now()
);

-- Feedback
create table feedback (
  id uuid primary key default gen_random_uuid(),
  gericht_id uuid references gerichte(id),
  person_name text not null,
  bewertung integer check (bewertung between 1 and 5),
  kommentar text,
  erstellt_am timestamptz default now()
);
