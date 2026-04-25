/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/instagram/import/route'

const mockHoleReelCaption = jest.fn()
const mockParseRezeptMitClaude = jest.fn()
const mockSupabaseFrom = jest.fn()

jest.mock('@/lib/instagram', () => ({
  normalisiereInstaUrl: jest.requireActual('@/lib/instagram').normalisiereInstaUrl,
  holeReelCaption: (...args: unknown[]) => mockHoleReelCaption(...args),
}))

jest.mock('@/lib/instagram-parser', () => ({
  parseRezeptMitClaude: (...args: unknown[]) => mockParseRezeptMitClaude(...args),
}))

jest.mock('@/lib/supabase-server', () => ({
  supabase: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/instagram/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/instagram/import', () => {
  beforeEach(() => {
    mockHoleReelCaption.mockReset()
    mockParseRezeptMitClaude.mockReset()
    mockSupabaseFrom.mockReset()
    process.env.INSTA_IMPORT_TOKEN = 'secret-test-token'
  })

  it('lehnt ungültigen Token ab', async () => {
    const res = await POST(makeRequest({ url: 'https://www.instagram.com/reel/ABC/', token: 'falsch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: false, error: 'Ungültiger Token', display: '⚠️ Ungültiger Token' })
  })

  it('lehnt ungültige URL ab', async () => {
    const res = await POST(makeRequest({ url: 'https://example.com/foo', token: 'secret-test-token' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Keine gültige Instagram-URL')
  })

  it('returnt existing=true bei Dedup-Treffer', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'g-123', name: 'Ofen Feta' }, error: null }),
        }),
      }),
    })

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC123/?igsh=xyz',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      existing: true,
      gericht_id: 'g-123',
      gericht_name: 'Ofen Feta',
      display: '↻ Ofen Feta (schon importiert)',
    })
    expect(mockHoleReelCaption).not.toHaveBeenCalled()
  })

  it('legt neues Gericht an bei Erfolg', async () => {
    let dedupCall = 0
    mockSupabaseFrom.mockImplementation(() => {
      dedupCall++
      if (dedupCall === 1) {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }
      }
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'new-id', name: 'Test' }, error: null }),
          }),
        }),
      }
    })
    mockHoleReelCaption.mockResolvedValue({ caption: 'Caption-Text' })
    mockParseRezeptMitClaude.mockResolvedValue({
      name: 'Test', aufwand: '30 Min', gesund: false,
      zutaten: [], rezept: { zutaten: ['x'], zubereitung: ['y'] },
    })

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC/',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body).toEqual({
      ok: true,
      existing: false,
      gericht_id: 'new-id',
      gericht_name: 'Test',
      display: '✓ Test',
    })
  })

  it('returnt Fehler wenn Insta keine Caption liefert', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    })
    mockHoleReelCaption.mockResolvedValue(null)

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC/',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('privat oder gelöscht')
  })

  it('returnt Fehler wenn Claude null returnt', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    })
    mockHoleReelCaption.mockResolvedValue({ caption: 'random' })
    mockParseRezeptMitClaude.mockResolvedValue(null)

    const res = await POST(makeRequest({
      url: 'https://www.instagram.com/reel/ABC/',
      token: 'secret-test-token',
    }))
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toContain('Rezept konnte nicht extrahiert werden')
  })

  it('returnt immer HTTP 200, auch bei Fehlern', async () => {
    const res1 = await POST(makeRequest({ url: 'x', token: 'falsch' }))
    expect(res1.status).toBe(200)
    const res2 = await POST(makeRequest({ url: 'https://example.com/', token: 'secret-test-token' }))
    expect(res2.status).toBe(200)
  })
})
