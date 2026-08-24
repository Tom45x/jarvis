/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/chefkoch/import/route'

const mockHoleChefkochRezept = jest.fn()
const mockParseZutatenMitClaude = jest.fn()
const mockSupabaseFrom = jest.fn()

jest.mock('@/lib/chefkoch', () => ({
  normalisiereChefkochUrl: jest.requireActual('@/lib/chefkoch').normalisiereChefkochUrl,
  holeChefkochRezept: (...args: unknown[]) => mockHoleChefkochRezept(...args),
}))

jest.mock('@/lib/chefkoch-parser', () => ({
  ...jest.requireActual('@/lib/chefkoch-parser'),
  parseZutatenMitClaude: (...args: unknown[]) => mockParseZutatenMitClaude(...args),
}))

jest.mock('@/lib/supabase-server', () => ({
  supabase: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/chefkoch/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/chefkoch/import', () => {
  beforeEach(() => {
    mockHoleChefkochRezept.mockReset()
    mockParseZutatenMitClaude.mockReset()
    mockSupabaseFrom.mockReset()
    process.env.CHEFKOCH_IMPORT_TOKEN = 'secret-test-token'
  })

  it('lehnt ungültigen Token ab', async () => {
    const res = await POST(makeRequest({ url: 'https://www.chefkoch.de/rezepte/123/Foo.html', token: 'falsch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: 'Ungültiger Token', display: '⚠️ Ungültiger Token' })
  })

  it('lehnt ungültige URL ab', async () => {
    const res = await POST(makeRequest({ url: 'https://example.com/foo', token: 'secret-test-token' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Keine gültige Chefkoch-Rezept-URL')
  })

  it('returnt existing=true bei Dedup-Treffer', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'g-1', name: 'Airfryer Pommes' }, error: null }),
        }),
      }),
    })

    const res = await POST(makeRequest({
      url: 'https://www.chefkoch.de/rezepte/123/Foo.html?utm_source=x',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      existing: true,
      gericht_id: 'g-1',
      gericht_name: 'Airfryer Pommes',
      display: '↻ Airfryer Pommes (schon importiert)',
    })
    expect(mockHoleChefkochRezept).not.toHaveBeenCalled()
  })

  it('legt neues Gericht mit kategorie airfryer und quelle chefkoch an', async () => {
    let dedupCall = 0
    let insertPayload: Record<string, unknown> | null = null
    mockSupabaseFrom.mockImplementation(() => {
      dedupCall++
      if (dedupCall === 1) {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      }
      return {
        insert: (payload: Record<string, unknown>) => {
          insertPayload = payload
          return { select: () => ({ single: async () => ({ data: { id: 'new-id', name: 'Airfryer Pommes' }, error: null }) }) }
        },
      }
    })
    mockHoleChefkochRezept.mockResolvedValue({
      name: 'Airfryer Pommes', zutatenRoh: ['500 g Kartoffeln'], zubereitung: ['Schneiden.', 'Frittieren.'], totalMinutes: 25,
    })
    mockParseZutatenMitClaude.mockResolvedValue({
      gesund: true,
      zutaten: [{ name: 'Kartoffeln', menge: 500, einheit: 'g', haltbarkeit_tage: 30 }],
    })

    const res = await POST(makeRequest({
      url: 'https://www.chefkoch.de/rezepte/123/Foo.html',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      existing: false,
      gericht_id: 'new-id',
      gericht_name: 'Airfryer Pommes',
      display: '✓ Airfryer Pommes',
    })
    expect(insertPayload).toMatchObject({
      name: 'Airfryer Pommes',
      kategorie: 'airfryer',
      quelle: 'chefkoch',
      aufwand: '30 Min',
      gesund: true,
      zutaten: [{ name: 'Kartoffeln', menge: 500, einheit: 'g', haltbarkeit_tage: 30 }],
      rezept: { zutaten: ['500 g Kartoffeln'], zubereitung: ['Schneiden.', 'Frittieren.'] },
    })
  })

  it('returnt Fehler wenn Chefkoch kein Rezept liefert', async () => {
    mockSupabaseFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) })
    mockHoleChefkochRezept.mockResolvedValue(null)

    const res = await POST(makeRequest({ url: 'https://www.chefkoch.de/rezepte/123/Foo.html', token: 'secret-test-token' }))
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('Rezept')
  })

  it('returnt Fehler wenn Claude null returnt', async () => {
    mockSupabaseFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) })
    mockHoleChefkochRezept.mockResolvedValue({
      name: 'Airfryer Pommes', zutatenRoh: ['500 g Kartoffeln'], zubereitung: ['Schneiden.'], totalMinutes: 25,
    })
    mockParseZutatenMitClaude.mockResolvedValue(null)

    const res = await POST(makeRequest({ url: 'https://www.chefkoch.de/rezepte/123/Foo.html', token: 'secret-test-token' }))
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('Zutaten')
  })

  it('returnt immer HTTP 200, auch bei Fehlern', async () => {
    const res1 = await POST(makeRequest({ url: 'x', token: 'falsch' }))
    expect(res1.status).toBe(200)
    const res2 = await POST(makeRequest({ url: 'https://example.com/', token: 'secret-test-token' }))
    expect(res2.status).toBe(200)
  })
})
