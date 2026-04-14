export type Mahlzeit = 'mittag' | 'abend'

export type Kategorie =
  | 'fleisch'
  | 'nudeln'
  | 'suppe'
  | 'auflauf'
  | 'fisch'
  | 'salat'
  | 'sonstiges'
  | 'kinder'

export interface Gericht {
  id: string
  name: string
  zutaten: string[]
  gesund: boolean
  kategorie: Kategorie
  beliebtheit: Record<string, number> // person_name → 1-5
  quelle: 'manuell' | 'themealdb'
}

export interface FamilieMitglied {
  id: string
  name: string
  alter: number | null
  lieblingsgerichte: string[]
  abneigungen: string[]
  lieblingsobst: string[]
  lieblingsgemuese: string[]
  notizen: string
}

export interface WochenplanEintrag {
  tag: 'montag' | 'dienstag' | 'mittwoch' | 'donnerstag' | 'freitag' | 'samstag' | 'sonntag'
  mahlzeit: Mahlzeit
  gericht_id: string
  gericht_name: string
}

export interface Wochenplan {
  id: string
  woche_start: string // ISO date string, e.g. "2026-04-13"
  eintraege: WochenplanEintrag[]
  status: 'entwurf' | 'genehmigt'
  erstellt_am: string
}

export interface EinkaufsArtikel {
  name: string
  menge: string
  einheit: string
  routing: 'picnic' | 'bring'
}

export interface Einkaufsliste {
  id: string
  wochenplan_id: string
  artikel: EinkaufsArtikel[]
  erstellt_am: string
}

export interface DrinkVorschlag {
  name: string
  zutaten: string[]
}
