/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/putzplan/route'
import { POST, DELETE } from '@/app/api/putzplan/[id]/route'

type Ergebnis = { data: unknown; error: { message: string } | null }

// Minimaler Supabase-Query-Builder: jede Methode wird protokolliert,
// das Ergebnis pro Tabelle kommt aus `ergebnisse`
const aufrufe: { tabelle: string; methode: string; args: unknown[] }[] = []
let ergebnisse: Record<string, Ergebnis> = {}

function builder(tabelle: string) {
  const b: Record<string, unknown> = {}
  for (const methode of ['select', 'order', 'in', 'eq', 'single', 'upsert', 'delete']) {
    b[methode] = (...args: unknown[]) => {
      aufrufe.push({ tabelle, methode, args })
      return b
    }
  }
  b.then = (resolve: (e: Ergebnis) => unknown) => resolve(ergebnisse[tabelle] ?? { data: null, error: null })
  return b
}

jest.mock('@/lib/supabase-server', () => ({
  supabase: { from: (tabelle: string) => builder(tabelle) },
}))

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (method: string) => new NextRequest('http://localhost/api/putzplan/a1', { method })

beforeEach(() => {
  aufrufe.length = 0
  ergebnisse = {}
  jest.useFakeTimers().setSystemTime(new Date('2026-09-28T10:00:00Z')) // Montag, KW 40
})

afterEach(() => jest.useRealTimers())

describe('GET /api/putzplan', () => {
  it('markiert nur Erledigungen der aktuellen Periode als erledigt', async () => {
    ergebnisse = {
      putz_aufgaben: {
        data: [
          { id: 'w', titel: 'WC', beschreibung: null, rhythmus: 'woche', wochentag: 1, sortierung: 1 },
          { id: 'm', titel: 'Betten', beschreibung: null, rhythmus: 'monat', wochentag: 5, sortierung: 2 },
          { id: 'q', titel: 'Fenster', beschreibung: null, rhythmus: 'quartal', wochentag: null, sortierung: 3 },
        ],
        error: null,
      },
      putz_erledigungen: {
        data: [
          { aufgabe_id: 'w', periode: '2026-W40', erledigt_am: '2026-09-28T08:00:00Z' },
          // Monatsschlüssel an einer Wochenaufgabe zählt nicht
          { aufgabe_id: 'q', periode: '2026-09', erledigt_am: '2026-09-01T08:00:00Z' },
        ],
        error: null,
      },
    }

    const res = await GET()
    const body = await res.json()

    expect(body.heute).toBe(1)
    expect(body.quartal).toBe('2026-Q3')
    expect(body.aufgaben.map((a: { id: string; erledigt: boolean }) => [a.id, a.erledigt])).toEqual([
      ['w', true],
      ['m', false],
      ['q', false],
    ])
    expect(body.aufgaben[0].erledigt_am).toBe('2026-09-28T08:00:00Z')

    const periodenFilter = aufrufe.find(a => a.tabelle === 'putz_erledigungen' && a.methode === 'in')
    expect(periodenFilter?.args).toEqual(['periode', ['2026-W40', '2026-09', '2026-Q3']])
  })

  it('gibt 500 bei Datenbankfehler', async () => {
    ergebnisse = { putz_aufgaben: { data: null, error: { message: 'kaputt' } } }
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/putzplan/[id]', () => {
  it('speichert die Erledigung mit dem Periodenschlüssel des Rhythmus', async () => {
    ergebnisse = {
      putz_aufgaben: { data: { rhythmus: 'monat' }, error: null },
      putz_erledigungen: { data: { erledigt_am: '2026-09-28T10:00:00Z' }, error: null },
    }

    const res = await POST(req('POST'), params('a1'))

    expect(res.status).toBe(200)
    const upsert = aufrufe.find(a => a.methode === 'upsert')
    expect(upsert?.args[0]).toEqual({ aufgabe_id: 'a1', periode: '2026-09' })
    expect(await res.json()).toEqual({ erledigt_am: '2026-09-28T10:00:00Z' })
  })

  it('gibt 404 für unbekannte Aufgabe', async () => {
    ergebnisse = { putz_aufgaben: { data: null, error: { message: 'not found' } } }
    const res = await POST(req('POST'), params('gibtsnicht'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/putzplan/[id]', () => {
  it('löscht nur die Erledigung der aktuellen Periode', async () => {
    ergebnisse = {
      putz_aufgaben: { data: { rhythmus: 'woche' }, error: null },
      putz_erledigungen: { data: null, error: null },
    }

    const res = await DELETE(req('DELETE'), params('a1'))

    expect(res.status).toBe(200)
    const filter = aufrufe.filter(a => a.tabelle === 'putz_erledigungen' && a.methode === 'eq')
    expect(filter.map(f => f.args)).toEqual([
      ['aufgabe_id', 'a1'],
      ['periode', '2026-W40'],
    ])
  })
})
