jest.mock('@/lib/picnic', () => ({
  sucheArtikel: jest.fn(),
}))

import { wendeGestrichenAn, wendeGestrichenAnPicnic, zaehleItems } from '@/lib/einkaufsliste-berechnen'
import type { EinkaufsItem, PicnicListenArtikel, Einkaufsliste } from '@/types'

describe('wendeGestrichenAn', () => {
  const items: EinkaufsItem[] = [
    { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
    { name: 'Paprika', menge: 1, einheit: 'Stück' },
    { name: 'Zucchini', menge: 1, einheit: 'Stück' },
  ]

  it('entfernt gestrichene Items case-insensitive', () => {
    const result = wendeGestrichenAn(items, ['paprika'])
    expect(result).toEqual([
      { name: 'Zwiebeln', menge: 2, einheit: 'Stück' },
      { name: 'Zucchini', menge: 1, einheit: 'Stück' },
    ])
  })

  it('leere gestrichen-Liste lässt alles drin', () => {
    expect(wendeGestrichenAn(items, [])).toEqual(items)
  })

  it('unbekannte Namen in gestrichen beeinflussen nichts', () => {
    expect(wendeGestrichenAn(items, ['Quatsch'])).toEqual(items)
  })
})

describe('wendeGestrichenAnPicnic', () => {
  const items: PicnicListenArtikel[] = [
    { picnicProdukt: 'Bio Zwiebeln', menge: 1, einheit: 'Packung', artikelId: 'a' },
    { picnicProdukt: 'Paprika rot', menge: 1, einheit: 'Packung', artikelId: 'b' },
  ]

  it('entfernt per picnicProdukt-Name', () => {
    const result = wendeGestrichenAnPicnic(items, ['Paprika rot'])
    expect(result).toHaveLength(1)
    expect(result[0].artikelId).toBe('a')
  })
})

describe('zaehleItems', () => {
  it('zählt picnic + bring1 + bring2, nicht ausVorrat', () => {
    const liste: Pick<Einkaufsliste, 'picnic' | 'bring1' | 'bring2'> = {
      picnic: [{ picnicProdukt: 'A', menge: 1, einheit: 'Packung', artikelId: '1' }],
      bring1: [{ name: 'X', menge: 1, einheit: 'g' }],
      bring2: [
        { name: 'Y', menge: 1, einheit: 'g' },
        { name: 'Z', menge: 1, einheit: 'g' },
      ],
    }
    expect(zaehleItems(liste)).toBe(4)
  })
})
