import {
  bestimmeEinfrierstatus,
  berechneBringDiff,
  berechnePicnicDiff,
  istGleichBring,
  istGleichPicnic,
} from '@/lib/einkaufsliste-diff'
import type { EinkaufsItem, PicnicListenArtikel } from '@/types'

describe('bestimmeEinfrierstatus', () => {
  it('Bring-1 ist am Einkaufstag 1 gefroren', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, false)
    expect(status.bring1Frozen).toBe(true)
    expect(status.bring2Frozen).toBe(false)
  })

  it('Bring-1 ist vor Einkaufstag 1 offen', () => {
    const dienstag = new Date('2026-04-14T10:00:00Z')
    const status = bestimmeEinfrierstatus(dienstag, 5, 6, false)
    expect(status.bring1Frozen).toBe(false)
    expect(status.bring2Frozen).toBe(false)
  })

  it('Bring-2 ist am Einkaufstag 2 gefroren', () => {
    const donnerstag = new Date('2026-04-16T10:00:00Z')
    const status = bestimmeEinfrierstatus(donnerstag, 1, 4, false)
    expect(status.bring2Frozen).toBe(true)
  })

  it('Picnic ist gefroren wenn bestellung_erkannt = true', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, true)
    expect(status.picnicFrozen).toBe(true)
  })

  it('Picnic ist offen wenn bestellung_erkannt = false', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, false)
    expect(status.picnicFrozen).toBe(false)
  })

  it('Sonntag liefert Wochenindex 7, nicht 0', () => {
    const sonntag = new Date('2026-04-19T10:00:00Z')
    const status = bestimmeEinfrierstatus(sonntag, 1, 4, false)
    expect(status.bring1Frozen).toBe(true)
    expect(status.bring2Frozen).toBe(true)
  })
})

describe('istGleichBring', () => {
  it('true bei identischen Listen', () => {
    const a: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const b: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    expect(istGleichBring(a, b)).toBe(true)
  })

  it('false bei anderer Menge', () => {
    const a: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const b: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 3, einheit: 'Stück' }]
    expect(istGleichBring(a, b)).toBe(false)
  })

  it('true unabhängig von Reihenfolge', () => {
    const a: EinkaufsItem[] = [
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
    ]
    const b: EinkaufsItem[] = [
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
    ]
    expect(istGleichBring(a, b)).toBe(true)
  })
})

describe('berechneBringDiff', () => {
  it('erkennt hinzugefügte Items', () => {
    const alt: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const neu: EinkaufsItem[] = [
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
    ]
    const diff = berechneBringDiff(alt, neu)
    expect(diff.hinzu).toEqual([{ name: 'Paprika', menge: 1, einheit: 'Stück' }])
    expect(diff.weg).toEqual([])
  })

  it('erkennt entfernte Items', () => {
    const alt: EinkaufsItem[] = [
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Paprika', menge: 1, einheit: 'Stück' },
    ]
    const neu: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const diff = berechneBringDiff(alt, neu)
    expect(diff.hinzu).toEqual([])
    expect(diff.weg).toEqual([{ name: 'Paprika', menge: 1, einheit: 'Stück' }])
  })

  it('erkennt Mengen-Änderung als weg+hinzu', () => {
    const alt: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }]
    const neu: EinkaufsItem[] = [{ name: 'Zwiebeln', menge: 3, einheit: 'Stück' }]
    const diff = berechneBringDiff(alt, neu)
    expect(diff.weg).toEqual([{ name: 'Zwiebeln', menge: 2, einheit: 'Stück' }])
    expect(diff.hinzu).toEqual([{ name: 'Zwiebeln', menge: 3, einheit: 'Stück' }])
  })
})

describe('istGleichPicnic / berechnePicnicDiff', () => {
  const a: PicnicListenArtikel = { picnicProdukt: 'Bio Zwiebeln 500g', menge: 1, einheit: 'Packung', artikelId: 's1001' }
  const b: PicnicListenArtikel = { picnicProdukt: 'Paprika rot 3er', menge: 1, einheit: 'Packung', artikelId: 's1002' }

  it('istGleichPicnic identisch', () => {
    expect(istGleichPicnic([a], [a])).toBe(true)
  })

  it('istGleichPicnic unterschiedlich', () => {
    expect(istGleichPicnic([a], [b])).toBe(false)
  })

  it('berechnePicnicDiff: +hinzu', () => {
    const diff = berechnePicnicDiff([a], [a, b])
    expect(diff.hinzu).toEqual([b])
    expect(diff.weg).toEqual([])
  })
})
