import { normalisiereChefkochUrl, holeChefkochRezept } from '@/lib/chefkoch'

describe('normalisiereChefkochUrl', () => {
  it('strippt Query-Params', () => {
    const result = normalisiereChefkochUrl(
      'https://www.chefkoch.de/rezepte/2405101379966674/Arme-Ritter.html?utm_source=ios&utm_medium=share'
    )
    expect(result).toBe('https://www.chefkoch.de/rezepte/2405101379966674/Arme-Ritter.html')
  })

  it('akzeptiert URL ohne Slug (nur ID)', () => {
    const result = normalisiereChefkochUrl('https://www.chefkoch.de/rezepte/2405101379966674/')
    expect(result).toBe('https://www.chefkoch.de/rezepte/2405101379966674/')
  })

  it('erzwingt https und www', () => {
    const result = normalisiereChefkochUrl('http://chefkoch.de/rezepte/123456/Foo-Bar.html')
    expect(result).toBe('https://www.chefkoch.de/rezepte/123456/Foo-Bar.html')
  })

  it('wirft bei ungültiger URL', () => {
    expect(() => normalisiereChefkochUrl('https://example.com/rezepte/123/')).toThrow()
    expect(() => normalisiereChefkochUrl('not-a-url')).toThrow()
    expect(() => normalisiereChefkochUrl('https://www.chefkoch.de/rs/s0/rezepte.html')).toThrow()
    expect(() => normalisiereChefkochUrl('https://www.chefkoch.de/rezepte/123456')).toThrow()
  })
})

describe('holeChefkochRezept', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  function htmlMitLdJson(graph: unknown[]): string {
    return `<html><head><script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script></head></html>`
  }

  const nestedRecipe = {
    '@type': 'Recipe',
    name: 'Arme Ritter mit heißem Blaubeerkompott',
    recipeIngredient: ['300 ml Milch', '2 Ei(er), Größe M', '50 g Zucker'],
    prepTime: 'PT15M',
    cookTime: 'PT25M',
    totalTime: 'PT40M',
    recipeInstructions: [
      {
        '@type': 'HowToSection',
        name: 'Zubereitung',
        itemListElement: [
          { '@type': 'HowToStep', position: 1, text: 'Milch erhitzen.' },
          { '@type': 'HowToStep', position: 2, text: 'Eier verquirlen.' },
        ],
      },
    ],
  }

  it('extrahiert Name, Zutaten, Zubereitung und Gesamtzeit', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => htmlMitLdJson([nestedRecipe, { '@type': 'WebPage' }]),
    })

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Arme Ritter mit heißem Blaubeerkompott')
    expect(result!.zutatenRoh).toEqual(['300 ml Milch', '2 Ei(er), Größe M', '50 g Zucker'])
    expect(result!.zubereitung).toEqual(['Milch erhitzen.', 'Eier verquirlen.'])
    expect(result!.totalMinutes).toBe(40)
  })

  it('flacht flache HowToStep-Arrays ab (ohne HowToSection)', async () => {
    const flatRecipe = {
      ...nestedRecipe,
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Schritt 1.' },
        { '@type': 'HowToStep', text: 'Schritt 2.' },
      ],
    }
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => htmlMitLdJson([flatRecipe]),
    })

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result!.zubereitung).toEqual(['Schritt 1.', 'Schritt 2.'])
  })

  it('berechnet totalMinutes aus prepTime+cookTime wenn totalTime fehlt', async () => {
    const { totalTime, ...ohneTotalTime } = nestedRecipe
    void totalTime
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => htmlMitLdJson([ohneTotalTime]),
    })

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result!.totalMinutes).toBe(40)
  })

  it('totalMinutes ist null wenn keine Zeitangaben vorhanden', async () => {
    const { prepTime, cookTime, totalTime, ...ohneZeiten } = nestedRecipe
    void prepTime; void cookTime; void totalTime
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => htmlMitLdJson([ohneZeiten]),
    })

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result!.totalMinutes).toBeNull()
  })

  it('returnt null wenn kein ld+json vorhanden', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><head></head><body>Kein Rezept hier</body></html>',
    })

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result).toBeNull()
  })

  it('returnt null wenn kein Recipe-Node im Graph ist', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => htmlMitLdJson([{ '@type': 'WebPage' }, { '@type': 'BreadcrumbList' }]),
    })

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result).toBeNull()
  })

  it('returnt null bei HTTP-Fehler', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404, text: async () => '' })

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result).toBeNull()
  })

  it('returnt null bei Netzwerkfehler', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network down'))

    const result = await holeChefkochRezept('https://www.chefkoch.de/rezepte/123/Foo.html')
    expect(result).toBeNull()
  })
})
