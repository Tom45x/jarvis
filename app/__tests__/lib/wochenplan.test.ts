import { getMontag } from '@/lib/datum-utils'
import { erstelleWochenplanEintraege } from '@/lib/wochenplan'
import type { Gericht } from '@/types'

// Mock supabase to avoid real DB calls
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'plan1',
              woche_start: '2026-04-13',
              eintraege: [],
              status: 'entwurf',
              erstellt_am: new Date().toISOString()
            },
            error: null
          })
        })
      })
    })
  }
}))

describe('getMontag', () => {
  it('gibt den Montag der aktuellen Woche zurück wenn Dienstag', () => {
    const dienstag = new Date('2026-04-14T10:00:00Z')
    const montag = getMontag(dienstag)
    expect(montag.getFullYear()).toBe(2026)
    expect(montag.getMonth()).toBe(3) // April = 3
    expect(montag.getDate()).toBe(13)
  })

  it('gibt denselben Tag zurück wenn schon Montag', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const result = getMontag(montag)
    expect(result.getDate()).toBe(13)
  })

  it('gibt den vorherigen Montag zurück wenn Sonntag', () => {
    const sonntag = new Date('2026-04-19T10:00:00Z')
    const result = getMontag(sonntag)
    expect(result.getDate()).toBe(13)
  })
})

describe('erstelleWochenplanEintraege', () => {
  const mockGerichte: Gericht[] = [
    { id: 'g1', name: 'Flickerklopse', zutaten: [], gesund: false, kategorie: 'fleisch', beliebtheit: {}, quelle: 'manuell' },
    { id: 'g2', name: 'Pizza Margherita', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell' },
  ]

  it('verbindet Claude-Antworten mit Gericht-IDs', () => {
    const claudeAntwort = [
      { tag: 'montag' as const, mahlzeit: 'mittag' as const, gericht_name: 'Flickerklopse' },
    ]
    const eintraege = erstelleWochenplanEintraege(claudeAntwort, mockGerichte)
    expect(eintraege).toHaveLength(1)
    expect(eintraege[0].gericht_id).toBe('g1')
    expect(eintraege[0].gericht_name).toBe('Flickerklopse')
  })

  it('überspringt Gerichte die nicht in der DB sind', () => {
    const claudeAntwort = [
      { tag: 'montag' as const, mahlzeit: 'mittag' as const, gericht_name: 'Unbekanntes Gericht' },
    ]
    const eintraege = erstelleWochenplanEintraege(claudeAntwort, mockGerichte)
    expect(eintraege).toHaveLength(0)
  })

  it('verarbeitet mehrere Einträge korrekt', () => {
    const claudeAntwort = [
      { tag: 'montag' as const, mahlzeit: 'mittag' as const, gericht_name: 'Flickerklopse' },
      { tag: 'montag' as const, mahlzeit: 'abend' as const, gericht_name: 'Pizza Margherita' },
      { tag: 'dienstag' as const, mahlzeit: 'mittag' as const, gericht_name: 'Nicht vorhanden' },
    ]
    const eintraege = erstelleWochenplanEintraege(claudeAntwort, mockGerichte)
    expect(eintraege).toHaveLength(2)
  })
})
