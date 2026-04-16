import { istTracked, normalisiereEinheit, parsePaketgroesse } from '@/lib/vorrat'

describe('istTracked', () => {
  it('gibt false für haltbarkeit < 14', () => {
    expect(istTracked(13)).toBe(false)
    expect(istTracked(7)).toBe(false)
    expect(istTracked(0)).toBe(false)
  })

  it('gibt true für haltbarkeit >= 14', () => {
    expect(istTracked(14)).toBe(true)
    expect(istTracked(30)).toBe(true)
    expect(istTracked(365)).toBe(true)
  })
})

describe('normalisiereEinheit', () => {
  it('g bleibt g', () => {
    expect(normalisiereEinheit(500, 'g')).toEqual({ wert: 500, basis: 'g' })
  })

  it('kg wird zu g', () => {
    expect(normalisiereEinheit(1, 'kg')).toEqual({ wert: 1000, basis: 'g' })
    expect(normalisiereEinheit(0.5, 'kg')).toEqual({ wert: 500, basis: 'g' })
  })

  it('ml bleibt ml', () => {
    expect(normalisiereEinheit(250, 'ml')).toEqual({ wert: 250, basis: 'ml' })
  })

  it('l wird zu ml', () => {
    expect(normalisiereEinheit(1, 'l')).toEqual({ wert: 1000, basis: 'ml' })
  })

  it('cl wird zu ml', () => {
    expect(normalisiereEinheit(10, 'cl')).toEqual({ wert: 100, basis: 'ml' })
  })

  it('TL wird zu g (5g pro TL)', () => {
    expect(normalisiereEinheit(1, 'TL')).toEqual({ wert: 5, basis: 'g' })
    expect(normalisiereEinheit(2, 'TL')).toEqual({ wert: 10, basis: 'g' })
  })

  it('EL wird zu g (15g pro EL)', () => {
    expect(normalisiereEinheit(1, 'EL')).toEqual({ wert: 15, basis: 'g' })
    expect(normalisiereEinheit(3, 'EL')).toEqual({ wert: 45, basis: 'g' })
  })

  it('Stück, Bund, Packung werden zu stueck', () => {
    expect(normalisiereEinheit(2, 'Stück')).toEqual({ wert: 2, basis: 'stueck' })
    expect(normalisiereEinheit(1, 'Bund')).toEqual({ wert: 1, basis: 'stueck' })
    expect(normalisiereEinheit(3, 'Packung')).toEqual({ wert: 3, basis: 'stueck' })
  })

  it('unbekannte Einheit wird zu stueck', () => {
    expect(normalisiereEinheit(1, 'Portion')).toEqual({ wert: 1, basis: 'stueck' })
  })

  it('Einheit ist case-insensitiv', () => {
    expect(normalisiereEinheit(1, 'tl')).toEqual({ wert: 5, basis: 'g' })
    expect(normalisiereEinheit(1, 'G')).toEqual({ wert: 1, basis: 'g' })
  })
})

describe('parsePaketgroesse', () => {
  it('erkennt Gramm', () => {
    expect(parsePaketgroesse('FUCHS Kreuzkümmel gemahlen 35g')).toEqual({ wert: 35, basis: 'g' })
    expect(parsePaketgroesse('Barilla Spaghetti 500g')).toEqual({ wert: 500, basis: 'g' })
  })

  it('erkennt Milliliter', () => {
    expect(parsePaketgroesse('Bertolli Olivenöl extra vergine 500ml')).toEqual({ wert: 500, basis: 'ml' })
  })

  it('erkennt Liter', () => {
    expect(parsePaketgroesse('Milch 3,5% Fett 1l')).toEqual({ wert: 1000, basis: 'ml' })
  })

  it('erkennt Kilogramm', () => {
    expect(parsePaketgroesse('Zucker 1kg')).toEqual({ wert: 1000, basis: 'g' })
  })

  it('gibt null zurück wenn keine Größe erkennbar', () => {
    expect(parsePaketgroesse('Netto Eier 6er Pack')).toBeNull()
    expect(parsePaketgroesse('Brot')).toBeNull()
  })

  it('verarbeitet Kommazahlen', () => {
    expect(parsePaketgroesse('Olivenöl 0,5l')).toEqual({ wert: 500, basis: 'ml' })
  })
})
