const mockSelect = jest.fn()
const mockUpsert = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: jest.fn(() => ({ select: mockSelect, upsert: mockUpsert })),
  },
}))

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

describe('ladeVorrat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('gibt leeren Array zurück wenn Supabase kein data liefert', async () => {
    const { ladeVorrat } = await import('@/lib/vorrat')
    mockSelect.mockResolvedValueOnce({ data: null })
    const result = await ladeVorrat()
    expect(result).toEqual([])
  })

  it('gibt Vorrat-Einträge zurück', async () => {
    const { ladeVorrat } = await import('@/lib/vorrat')
    const eintraege = [
      { zutat_name: 'kreuzkümmel', bestand: 30, einheit_basis: 'g' },
      { zutat_name: 'olivenöl', bestand: 450, einheit_basis: 'ml' },
    ]
    mockSelect.mockResolvedValueOnce({ data: eintraege })
    const result = await ladeVorrat()
    expect(result).toEqual(eintraege)
  })
})

describe('aktualisiereVorrat', () => {
  beforeEach(() => jest.clearAllMocks())

  it('bucht Kauf ein und zieht Verbrauch ab', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    const aktuellerVorrat = [{ zutat_name: 'kreuzkümmel', bestand: 0, einheit_basis: 'g' as const }]
    const kaeufe = [{
      zutat_name: 'kreuzkümmel',
      paket: { wert: 35, basis: 'g' as const },
      verbrauch: { wert: 5, basis: 'g' as const },
    }]
    await aktualisiereVorrat(aktuellerVorrat, kaeufe, [])
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ zutat_name: 'kreuzkümmel', bestand: 30 })]),
      { onConflict: 'zutat_name' }
    )
  })

  it('zieht ausVorrat-Verbrauch ab', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    const aktuellerVorrat = [{ zutat_name: 'olivenöl', bestand: 450, einheit_basis: 'ml' as const }]
    const ausVorratListe = [{ zutat_name: 'olivenöl', verbrauch: { wert: 30, basis: 'ml' as const } }]
    await aktualisiereVorrat(aktuellerVorrat, [], ausVorratListe)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ zutat_name: 'olivenöl', bestand: 420 })]),
      { onConflict: 'zutat_name' }
    )
  })

  it('lässt bestand nicht unter 0 fallen', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    const aktuellerVorrat = [{ zutat_name: 'nudeln', bestand: 3, einheit_basis: 'g' as const }]
    const ausVorratListe = [{ zutat_name: 'nudeln', verbrauch: { wert: 10, basis: 'g' as const } }]
    await aktualisiereVorrat(aktuellerVorrat, [], ausVorratListe)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ zutat_name: 'nudeln', bestand: 0 })]),
      { onConflict: 'zutat_name' }
    )
  })

  it('schluckt Fehler still', async () => {
    const { aktualisiereVorrat } = await import('@/lib/vorrat')
    mockUpsert.mockRejectedValueOnce(new Error('DB down'))
    await expect(
      aktualisiereVorrat([], [{ zutat_name: 'test', paket: null, verbrauch: { wert: 1, basis: 'g' } }], [])
    ).resolves.toBeUndefined()
  })
})
