import { validiereZutaten, validiereAufwand } from '@/lib/rezept-shared'

describe('validiereZutaten', () => {
  it('behält valide Zutaten', () => {
    const result = validiereZutaten([
      { name: 'Hähnchen', menge: 2, einheit: 'Stück', haltbarkeit_tage: 2 },
    ])
    expect(result).toEqual([
      { name: 'Hähnchen', menge: 2, einheit: 'Stück', haltbarkeit_tage: 2 },
    ])
  })

  it('droppt Zutaten mit ungültiger Einheit', () => {
    const result = validiereZutaten([
      { name: 'Hähnchen', menge: 2, einheit: 'Stück', haltbarkeit_tage: 2 },
      { name: 'Mystery', menge: 1, einheit: 'Wagenladung', haltbarkeit_tage: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Hähnchen')
  })

  it('droppt Zutaten mit fehlenden Feldern', () => {
    const result = validiereZutaten([
      { name: 'Hähnchen', einheit: 'Stück', haltbarkeit_tage: 2 },
      { name: 'Pasta', menge: 350, einheit: 'g' },
    ])
    expect(result).toHaveLength(0)
  })

  it('returnt leeres Array wenn Input kein Array ist', () => {
    expect(validiereZutaten(null)).toEqual([])
    expect(validiereZutaten(undefined)).toEqual([])
    expect(validiereZutaten('nope')).toEqual([])
  })
})

describe('validiereAufwand', () => {
  it('akzeptiert gültige Werte', () => {
    expect(validiereAufwand('45 Min')).toBe('45 Min')
  })

  it('fällt auf "30 Min" zurück bei ungültigem Wert', () => {
    expect(validiereAufwand('unklar')).toBe('30 Min')
    expect(validiereAufwand(undefined)).toBe('30 Min')
  })

  it('nutzt custom Fallback wenn angegeben', () => {
    expect(validiereAufwand('unklar', '15 Min')).toBe('15 Min')
  })
})
