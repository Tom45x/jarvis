import type { EinfrierStatus, EinkaufsItem, PicnicListenArtikel, SektionDiff } from '@/types'

export function bestimmeEinfrierstatus(
  jetzt: Date,
  einkaufstag1: number,
  einkaufstag2: number,
  picnicBestellt: boolean
): EinfrierStatus {
  const tag = jetzt.getDay() === 0 ? 7 : jetzt.getDay()
  return {
    picnicFrozen: picnicBestellt,
    bring1Frozen: tag >= einkaufstag1,
    bring2Frozen: tag >= einkaufstag2,
  }
}

function bringKey(item: EinkaufsItem): string {
  return `${item.name.toLowerCase()}|${item.einheit.toLowerCase()}|${item.menge}`
}

function picnicKey(item: PicnicListenArtikel): string {
  return item.artikelId
}

export function istGleichBring(a: EinkaufsItem[], b: EinkaufsItem[]): boolean {
  if (a.length !== b.length) return false
  const keysA = new Set(a.map(bringKey))
  return b.every(item => keysA.has(bringKey(item)))
}

export function istGleichPicnic(a: PicnicListenArtikel[], b: PicnicListenArtikel[]): boolean {
  if (a.length !== b.length) return false
  const keysA = new Set(a.map(picnicKey))
  return b.every(item => keysA.has(picnicKey(item)))
}

export function berechneBringDiff(alt: EinkaufsItem[], neu: EinkaufsItem[]): SektionDiff {
  const altKeys = new Map(alt.map(item => [bringKey(item), item]))
  const neuKeys = new Map(neu.map(item => [bringKey(item), item]))

  const hinzu: EinkaufsItem[] = []
  const weg: EinkaufsItem[] = []

  for (const [key, item] of neuKeys) {
    if (!altKeys.has(key)) hinzu.push(item)
  }
  for (const [key, item] of altKeys) {
    if (!neuKeys.has(key)) weg.push(item)
  }

  return { hinzu, weg }
}

export function berechnePicnicDiff(
  alt: PicnicListenArtikel[],
  neu: PicnicListenArtikel[]
): SektionDiff {
  const altIds = new Set(alt.map(p => p.artikelId))
  const neuIds = new Set(neu.map(p => p.artikelId))

  const hinzu = neu.filter(p => !altIds.has(p.artikelId))
  const weg = alt.filter(p => !neuIds.has(p.artikelId))

  return { hinzu, weg }
}
