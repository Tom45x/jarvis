import { berlinDatum, periodenSchluessel, periodeFuer } from '@/lib/putzplan'

describe('berlinDatum', () => {
  it('liefert Datum und Wochentag in Berlin, nicht in UTC', () => {
    // Sonntag 22:30 UTC = Montag 00:30 in Berlin (Sommerzeit)
    const d = berlinDatum(new Date('2026-09-27T22:30:00Z'))
    expect(d).toEqual({ jahr: 2026, monat: 9, tag: 28, wochentag: 1 })
  })

  it('zählt Sonntag als 7', () => {
    expect(berlinDatum(new Date('2026-09-27T10:00:00Z')).wochentag).toBe(7)
  })
})

describe('periodenSchluessel', () => {
  it('berechnet Woche, Monat und Quartal', () => {
    expect(periodenSchluessel(new Date('2026-09-28T10:00:00Z'))).toEqual({
      woche: '2026-W40',
      monat: '2026-09',
      quartal: '2026-Q3',
    })
  })

  it('wechselt um Mitternacht Berliner Zeit in die neue Woche', () => {
    expect(periodenSchluessel(new Date('2026-09-27T21:30:00Z')).woche).toBe('2026-W39')
    expect(periodenSchluessel(new Date('2026-09-27T22:30:00Z')).woche).toBe('2026-W40')
  })

  it('ordnet Tage am Jahreswechsel der richtigen ISO-Woche zu', () => {
    expect(periodenSchluessel(new Date('2026-12-31T12:00:00Z')).woche).toBe('2026-W53')
    expect(periodenSchluessel(new Date('2027-01-01T12:00:00Z')).woche).toBe('2026-W53')
    expect(periodenSchluessel(new Date('2027-01-04T12:00:00Z')).woche).toBe('2027-W01')
  })

  it('wechselt Monat und Quartal nach Berliner Zeit', () => {
    // 31.12. 23:30 UTC = 01.01. 00:30 in Berlin (Winterzeit)
    const p = periodenSchluessel(new Date('2026-12-31T23:30:00Z'))
    expect(p.monat).toBe('2027-01')
    expect(p.quartal).toBe('2027-Q1')
  })

  it('setzt Quartalsgrenzen korrekt', () => {
    expect(periodenSchluessel(new Date('2026-03-31T12:00:00Z')).quartal).toBe('2026-Q1')
    expect(periodenSchluessel(new Date('2026-04-01T12:00:00Z')).quartal).toBe('2026-Q2')
    expect(periodenSchluessel(new Date('2026-10-01T12:00:00Z')).quartal).toBe('2026-Q4')
  })
})

describe('periodeFuer', () => {
  it('wählt den Schlüssel passend zum Rhythmus', () => {
    const jetzt = new Date('2026-09-28T10:00:00Z')
    expect(periodeFuer('woche', jetzt)).toBe('2026-W40')
    expect(periodeFuer('monat', jetzt)).toBe('2026-09')
    expect(periodeFuer('quartal', jetzt)).toBe('2026-Q3')
  })
})
