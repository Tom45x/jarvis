import { generiereWochenplan } from '@/lib/claude'
import type { FamilieMitglied, Gericht } from '@/types'

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            mahlzeiten: [
              { tag: 'montag', mahlzeit: 'mittag', gericht_name: 'Flickerklopse' },
              { tag: 'montag', mahlzeit: 'abend', gericht_name: 'Pizza Margherita' },
            ],
            drinks: [
              { name: 'Erdbeer-Mango-Saft', zutaten: ['300g Erdbeeren', '1 Mango'] }
            ]
          })
        }]
      })
    }
  }))
}))

describe('generiereWochenplan', () => {
  const mockProfile: FamilieMitglied[] = [{
    id: '1', name: 'Ben', alter: 11,
    lieblingsgerichte: ['Flickerklopse'], abneigungen: ['Brokkoli'],
    lieblingsobst: [], lieblingsgemuese: [], notizen: ''
  }]

  const mockGerichte: Gericht[] = [{
    id: 'g1', name: 'Flickerklopse', zutaten: [], gesund: false,
    kategorie: 'fleisch', beliebtheit: {}, quelle: 'manuell'
  }]

  it('gibt mahlzeiten und drinks zurück', async () => {
    const result = await generiereWochenplan(mockProfile, mockGerichte)
    expect(result).toHaveProperty('mahlzeiten')
    expect(result).toHaveProperty('drinks')
  })

  it('mahlzeiten ist ein Array', async () => {
    const result = await generiereWochenplan(mockProfile, mockGerichte)
    expect(Array.isArray(result.mahlzeiten)).toBe(true)
  })

  it('drinks ist ein Array', async () => {
    const result = await generiereWochenplan(mockProfile, mockGerichte)
    expect(Array.isArray(result.drinks)).toBe(true)
  })

  it('jede Mahlzeit hat tag, mahlzeit und gericht_name', async () => {
    const result = await generiereWochenplan(mockProfile, mockGerichte)
    result.mahlzeiten.forEach(eintrag => {
      expect(eintrag).toHaveProperty('tag')
      expect(eintrag).toHaveProperty('mahlzeit')
      expect(eintrag).toHaveProperty('gericht_name')
    })
  })

  it('jeder Drink hat name und zutaten', async () => {
    const result = await generiereWochenplan(mockProfile, mockGerichte)
    result.drinks.forEach(drink => {
      expect(drink).toHaveProperty('name')
      expect(drink).toHaveProperty('zutaten')
    })
  })
})
