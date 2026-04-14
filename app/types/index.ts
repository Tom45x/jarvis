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

export interface Zutat {
  name: string
  menge: number
  einheit: string       // 'g' | 'ml' | 'Stück' | 'EL' | 'TL' | 'Bund' | 'Packung' | 'kg' | 'l'
  haltbarkeit_tage: number  // wie viele Tage die Zutat im Kühlschrank hält
}

export interface Gericht {
  id: string
  name: string
  zutaten: Zutat[]     // war: string[] — jetzt strukturiert
  gesund: boolean
  kategorie: Kategorie
  beliebtheit: Record<string, number>
  quelle: 'manuell' | 'themealdb'
  tausch_count?: number   // wie oft das Gericht im Wochenplan getauscht wurde
  gesperrt?: boolean      // bei 4+ Tauschvorgängen automatisch gesperrt
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
  woche_start: string
  eintraege: WochenplanEintrag[]
  status: 'entwurf' | 'genehmigt'
  erstellt_am: string
}

export interface EinkaufsItem {
  name: string
  menge: number
  einheit: string
}

export interface EinkaufslistenErgebnis {
  einkauf1: EinkaufsItem[]
  einkauf2: EinkaufsItem[]
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

export interface Regelbedarf {
  id: string
  name: string
  menge: number
  einheit: string
}

export interface PicnicArtikel {
  artikelId: string
  name: string
  preis: number   // in Cent
}

export interface EinkaufsRouting {
  picnic: EinkaufsItem[]
  bring: EinkaufsItem[]
}
