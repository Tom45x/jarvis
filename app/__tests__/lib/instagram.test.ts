import { normalisiereInstaUrl, holeReelCaption, dekodiereHtmlEntities } from '@/lib/instagram'

describe('normalisiereInstaUrl', () => {
  it('strippt Query-Params', () => {
    const result = normalisiereInstaUrl('https://www.instagram.com/reel/ABC123/?igsh=xyz&utm_source=test')
    expect(result).toBe('https://www.instagram.com/reel/ABC123/')
  })

  it('fügt Trailing-Slash hinzu falls fehlt', () => {
    const result = normalisiereInstaUrl('https://www.instagram.com/reel/ABC123')
    expect(result).toBe('https://www.instagram.com/reel/ABC123/')
  })

  it('akzeptiert /p/ Posts', () => {
    const result = normalisiereInstaUrl('https://www.instagram.com/p/XYZ789/?igsh=foo')
    expect(result).toBe('https://www.instagram.com/p/XYZ789/')
  })

  it('wirft bei ungültiger URL', () => {
    expect(() => normalisiereInstaUrl('https://example.com/foo')).toThrow()
    expect(() => normalisiereInstaUrl('not-a-url')).toThrow()
    expect(() => normalisiereInstaUrl('https://www.instagram.com/profile/')).toThrow()
  })
})

describe('dekodiereHtmlEntities', () => {
  it('dekodiert Hex-Entities', () => {
    expect(dekodiereHtmlEntities('H&#xe4;hnchen')).toBe('Hähnchen')
    expect(dekodiereHtmlEntities('Br&#xfc;he')).toBe('Brühe')
    expect(dekodiereHtmlEntities('Stra&#xdf;e')).toBe('Straße')
  })

  it('dekodiert Decimal-Entities', () => {
    expect(dekodiereHtmlEntities('Caf&#233;')).toBe('Café')
  })

  it('dekodiert Named-Entities', () => {
    expect(dekodiereHtmlEntities('A &amp; B')).toBe('A & B')
    expect(dekodiereHtmlEntities('&quot;Hallo&quot;')).toBe('"Hallo"')
  })

  it('lässt Klartext unangetastet', () => {
    expect(dekodiereHtmlEntities('Hallo Welt')).toBe('Hallo Welt')
  })
})

describe('holeReelCaption', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('extrahiert Caption aus og:description', async () => {
    const html = `<html><head>
      <meta property="og:description" content="Hähnchen Pasta&#x1f357;
Zutaten:
2 H&#xe4;hnchenbr&#xfc;ste
350g Pasta">
    </head></html>`
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => html,
    })

    const result = await holeReelCaption('https://www.instagram.com/reel/ABC/')
    expect(result).not.toBeNull()
    expect(result!.caption).toContain('Hähnchen Pasta')
    expect(result!.caption).toContain('Hähnchenbrüste')
  })

  it('returnt null wenn og:description fehlt', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><head></head><body></body></html>',
    })

    const result = await holeReelCaption('https://www.instagram.com/reel/ABC/')
    expect(result).toBeNull()
  })

  it('returnt null bei HTTP-Fehler', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    })

    const result = await holeReelCaption('https://www.instagram.com/reel/ABC/')
    expect(result).toBeNull()
  })

  it('sendet Mobile-User-Agent', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<meta property="og:description" content="x">',
    })

    await holeReelCaption('https://www.instagram.com/reel/ABC/')
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1].headers['User-Agent']).toMatch(/iPhone/)
  })
})
