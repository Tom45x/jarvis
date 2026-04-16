import type { Gericht, WochenplanEintrag, EinkaufsItem, EinkaufslistenErgebnis, EinkaufsRouting, VorratEintrag } from '@/types'
import { istTracked, normalisiereEinheit } from '@/lib/vorrat'

// Zutaten, die immer im Haus sind — kommen nie auf die Einkaufsliste
const GRUNDVORRAT_KEYWORDS = [
  // Grundgewürze
  'salz', 'pfeffer', 'zucker', 'paprikapulver',
  // Backzutaten
  'mehl', 'backpulver', 'natron', 'speisestärke', 'stärke',
  // Fette & Öle
  'öl', 'speiseöl',
  // Küche-Basics
  'knoblauch', 'kartoffel',
]

export function istGrundvorrat(zutatName: string): boolean {
  const lower = zutatName.toLowerCase()
  return GRUNDVORRAT_KEYWORDS.some(kw => lower.includes(kw))
}

export function istInRegelbedarf(zutatName: string, regelbedarfNamen: string[]): boolean {
  const lower = zutatName.toLowerCase()
  return regelbedarfNamen.some(r => {
    const rLower = r.toLowerCase()
    return lower.includes(rLower) || rLower.includes(lower)
  })
}

export function istBringPflicht(zutatName: string, bringKeywords: string[]): boolean {
  const nameLower = zutatName.toLowerCase()
  return bringKeywords.some(kw => nameLower.includes(kw.toLowerCase()))
}

export function splitNachRouting(
  items: EinkaufsItem[],
  bringKeywords: string[]
): EinkaufsRouting {
  const picnic: EinkaufsItem[] = []
  const bring: EinkaufsItem[] = []

  for (const item of items) {
    if (istBringPflicht(item.name, bringKeywords)) {
      bring.push(item)
    } else {
      picnic.push(item)
    }
  }

  return { picnic, bring }
}

// Wochenindex: 1=Montag, 2=Dienstag, ..., 6=Samstag, 7=Sonntag
const TAG_INDEX: Record<string, number> = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4,
  freitag: 5, samstag: 6, sonntag: 7
}

export function tagZuWochenindex(tag: string): number {
  return TAG_INDEX[tag] ?? 0
}

export function aggregiere(items: EinkaufsItem[]): EinkaufsItem[] {
  const map = new Map<string, EinkaufsItem>()
  for (const item of items) {
    const key = `${item.name.toLowerCase()}|${item.einheit.toLowerCase()}`
    const existing = map.get(key)
    if (existing) {
      existing.menge += item.menge
    } else {
      map.set(key, { ...item })
    }
  }
  return Array.from(map.values())
}

function istReste(gerichtName: string): boolean {
  return gerichtName.includes('(Reste)')
}

function basisName(name: string): string {
  return name.replace(/\s*\(Reste\)\s*$/, '').trim()
}

export function generiereEinkaufslisten(
  eintraege: WochenplanEintrag[],
  gerichte: Gericht[],
  einkaufstag2: number,
  regelbedarfNamen: string[] = [],
  vorrat: VorratEintrag[] = []
): EinkaufslistenErgebnis {
  const gerichtMap = new Map(gerichte.map(g => [g.name, g]))

  const gerichteNamenMitResten = new Set(
    eintraege
      .filter(e => istReste(e.gericht_name))
      .map(e => basisName(e.gericht_name))
  )

  const relevantEintraege = eintraege.filter(e => !istReste(e.gericht_name))

  const roh1: EinkaufsItem[] = []
  const roh2: EinkaufsItem[] = []
  const trackedNamen = new Set<string>()

  for (const eintrag of relevantEintraege) {
    const gericht = gerichtMap.get(eintrag.gericht_name)
    if (!gericht || gericht.zutaten.length === 0) continue

    if (gericht.zutaten.some(z => z.name === 'Essen wird bestellt')) continue

    const tagIndex = tagZuWochenindex(eintrag.tag)
    if (tagIndex === 0) continue
    const hatReste = gerichteNamenMitResten.has(eintrag.gericht_name)
    const faktor = hatReste ? 2 : 1

    for (const zutat of gericht.zutaten) {
      if (istGrundvorrat(zutat.name)) continue
      if (istInRegelbedarf(zutat.name, regelbedarfNamen)) continue

      const item: EinkaufsItem = {
        name: zutat.name,
        menge: zutat.menge * faktor,
        einheit: zutat.einheit,
      }

      if (istTracked(zutat.haltbarkeit_tage)) {
        trackedNamen.add(zutat.name.toLowerCase())
      }

      if (zutat.haltbarkeit_tage >= 5) {
        roh1.push(item)
      } else if (tagIndex < einkaufstag2) {
        roh1.push(item)
      } else {
        roh2.push(item)
      }
    }
  }

  // Vorrat-Check auf aggregierten einkauf1-Daten
  const einkauf1Aggregiert = aggregiere(roh1)
  const einkauf1Final: EinkaufsItem[] = []
  const ausVorrat: EinkaufsItem[] = []

  if (vorrat.length > 0) {
    const vorratMap = new Map(vorrat.map(v => [v.zutat_name, v]))

    for (const item of einkauf1Aggregiert) {
      const key = item.name.toLowerCase()
      if (trackedNamen.has(key)) {
        const norm = normalisiereEinheit(item.menge, item.einheit)
        const eintragVorrat = vorratMap.get(key)
        if (eintragVorrat && eintragVorrat.einheit_basis === norm.basis && eintragVorrat.bestand >= norm.wert) {
          ausVorrat.push(item)
          continue
        }
      }
      einkauf1Final.push(item)
    }
  } else {
    einkauf1Final.push(...einkauf1Aggregiert)
  }

  return {
    einkauf1: einkauf1Final,
    einkauf2: aggregiere(roh2),
    ausVorrat,
  }
}
