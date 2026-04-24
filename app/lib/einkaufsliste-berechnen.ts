import type {
  EinkaufsItem,
  PicnicListenArtikel,
  Einkaufsliste,
  WochenplanEintrag,
  Gericht,
  VorratEintrag,
  Regelbedarf,
} from '@/types'
import { generiereEinkaufslisten, splitNachRouting, aggregiere } from '@/lib/einkaufsliste'
import { sucheArtikel } from '@/lib/picnic'

export function wendeGestrichenAn(items: EinkaufsItem[], gestrichen: string[]): EinkaufsItem[] {
  if (gestrichen.length === 0) return items
  const set = new Set(gestrichen.map(s => s.toLowerCase()))
  return items.filter(i => !set.has(i.name.toLowerCase()))
}

export function wendeGestrichenAnPicnic(
  items: PicnicListenArtikel[],
  gestrichen: string[]
): PicnicListenArtikel[] {
  if (gestrichen.length === 0) return items
  const set = new Set(gestrichen.map(s => s.toLowerCase()))
  return items.filter(i => !set.has(i.picnicProdukt.toLowerCase()))
}

export function zaehleItems(
  liste: Pick<Einkaufsliste, 'picnic' | 'bring1' | 'bring2'>
): number {
  return liste.picnic.length + liste.bring1.length + liste.bring2.length
}

export interface ListenEingabe {
  eintraege: WochenplanEintrag[]
  gerichte: Gericht[]
  einkaufstag2: number
  regelbedarf: Regelbedarf[]
  vorrat: VorratEintrag[]
  bringKeywords: string[]
  mindestbestellwert: number
  extrasZutaten: EinkaufsItem[]
  gestrichen: string[]
}

export interface BerechneteListen {
  picnic: PicnicListenArtikel[]
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
  ausVorrat: EinkaufsItem[]
}

export async function berechneListeFuerPlan(eingabe: ListenEingabe): Promise<BerechneteListen> {
  const regelbedarfNamen = eingabe.regelbedarf.map(r => r.name)
  const { einkauf1, einkauf2, ausVorrat } = generiereEinkaufslisten(
    eingabe.eintraege,
    eingabe.gerichte,
    eingabe.einkaufstag2,
    regelbedarfNamen,
    eingabe.vorrat
  )

  const einkauf1MitExtras = aggregiere([...einkauf1, ...eingabe.extrasZutaten])
  const routing1 = splitNachRouting(einkauf1MitExtras, eingabe.bringKeywords)

  const picnicKandidaten = [...routing1.picnic]
  const picnicArtikel: PicnicListenArtikel[] = []
  const nichtGefunden: EinkaufsItem[] = []
  let gesamtpreis = 0

  for (const item of picnicKandidaten) {
    const artikel = await sucheArtikel(item.name)
    if (artikel) {
      picnicArtikel.push({
        picnicProdukt: artikel.name,
        menge: item.menge,
        einheit: item.einheit,
        artikelId: artikel.artikelId,
      })
      gesamtpreis += artikel.preis / 100
    } else {
      nichtGefunden.push(item)
    }
  }

  for (const r of eingabe.regelbedarf) {
    const artikel = await sucheArtikel(r.name)
    if (artikel) {
      picnicArtikel.push({
        picnicProdukt: artikel.name,
        menge: r.menge,
        einheit: r.einheit,
        artikelId: artikel.artikelId,
      })
    }
  }

  const unterMindestwert = gesamtpreis < eingabe.mindestbestellwert
  const bring1Final = unterMindestwert
    ? [...routing1.bring, ...picnicKandidaten]
    : [...routing1.bring, ...nichtGefunden]

  const picnicFinal = unterMindestwert ? [] : picnicArtikel

  return {
    picnic: wendeGestrichenAnPicnic(picnicFinal, eingabe.gestrichen),
    bring1: wendeGestrichenAn(bring1Final, eingabe.gestrichen),
    bring2: wendeGestrichenAn(aggregiere(einkauf2), eingabe.gestrichen),
    ausVorrat,
  }
}
