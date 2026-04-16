export type Mahlzeit = 'frühstück' | 'mittag' | 'abend'

export type Kategorie =
  | 'fleisch'
  | 'nudeln'
  | 'suppe'
  | 'auflauf'
  | 'fisch'
  | 'salat'
  | 'sonstiges'
  | 'kinder'
  | 'trainingstage'
  | 'frühstück'
  | 'filmabend'

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
  quelle: 'manuell' | 'themealdb' | 'ki-vorschlag'
  aufwand?: string        // '15 Min' | '30 Min' | '45 Min' | '60+ Min'
  tausch_count?: number   // wie oft das Gericht im Wochenplan getauscht wurde
  gesperrt?: boolean      // bei 4+ Tauschvorgängen automatisch gesperrt
  bewertung?: number      // 1-5 Sterne, default 3; 5-Sterne werden öfter vorgeschlagen
  rezept?: {
    zutaten: string[]       // lesbare Strings: "200g Nudeln", "2 Eier"
    zubereitung: string[]   // ["Wasser zum Kochen bringen", "Nudeln al dente garen"]
  }
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
  ausVorrat: EinkaufsItem[]
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

export interface NormierteMenge {
  wert: number
  basis: 'g' | 'ml' | 'stueck'
}

export interface VorratEintrag {
  zutat_name: string        // normalisiert: lowercase
  bestand: number
  einheit_basis: 'g' | 'ml' | 'stueck'
}

export interface WochenAnsicht {
  carryOverPlan: Wochenplan | null
  aktiverPlan: Wochenplan | null
}
