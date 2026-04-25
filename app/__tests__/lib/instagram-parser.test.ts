import { parseRezeptMitClaude } from '@/lib/instagram-parser'

const mockCreate = jest.fn()

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

jest.mock('@/lib/claude-tracking', () => ({
  logClaudeNutzung: jest.fn().mockResolvedValue(undefined),
}))

describe('parseRezeptMitClaude', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  const validResponse = {
    name: 'Ofen Feta Hähnchen Pasta',
    aufwand: '45 Min',
    gesund: false,
    zutaten: [
      { name: 'Hähnchenbrust', menge: 2, einheit: 'Stück', haltbarkeit_tage: 2 },
      { name: 'Feta', menge: 1, einheit: 'Packung', haltbarkeit_tage: 14 },
      { name: 'Pasta', menge: 350, einheit: 'g', haltbarkeit_tage: 730 },
    ],
    rezept: {
      zutaten: ['2 Hähnchenbrüste', '1 Feta', '350g Pasta'],
      zubereitung: ['Bärlauch klein schneiden.', 'Auflaufform vorbereiten.'],
    },
  }

  function mockClaudeResponse(payload: unknown): void {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      usage: { input_tokens: 100, output_tokens: 200 },
    })
  }

  it('parst valide Claude-Antwort', async () => {
    mockClaudeResponse(validResponse)
    const result = await parseRezeptMitClaude('Caption-Text')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Ofen Feta Hähnchen Pasta')
    expect(result!.aufwand).toBe('45 Min')
    expect(result!.zutaten).toHaveLength(3)
  })

  it('returnt null bei leerem Output', async () => {
    mockClaudeResponse({
      ...validResponse,
      zutaten: [],
      rezept: { zutaten: [], zubereitung: [] },
    })
    const result = await parseRezeptMitClaude('Caption ohne Rezept')
    expect(result).toBeNull()
  })

  it('returnt null bei kaputtem JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'das ist kein json' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })
    const result = await parseRezeptMitClaude('Caption')
    expect(result).toBeNull()
  })

  it('fallbackt aufwand auf "30 Min" bei ungültigem Wert', async () => {
    mockClaudeResponse({ ...validResponse, aufwand: 'unklar' })
    const result = await parseRezeptMitClaude('Caption')
    expect(result!.aufwand).toBe('30 Min')
  })

  it('droppt zutaten mit ungültiger Einheit', async () => {
    mockClaudeResponse({
      ...validResponse,
      zutaten: [
        { name: 'Hähnchen', menge: 2, einheit: 'Stück', haltbarkeit_tage: 2 },
        { name: 'Mystery', menge: 1, einheit: 'Wagenladung', haltbarkeit_tage: 1 },
      ],
    })
    const result = await parseRezeptMitClaude('Caption')
    expect(result!.zutaten).toHaveLength(1)
    expect(result!.zutaten[0].name).toBe('Hähnchen')
  })

  it('extrahiert JSON auch wenn umschließender Text vorhanden', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: `Hier ist das JSON:\n${JSON.stringify(validResponse)}\nViel Spaß!` }],
      usage: { input_tokens: 100, output_tokens: 200 },
    })
    const result = await parseRezeptMitClaude('Caption')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Ofen Feta Hähnchen Pasta')
  })

  it('loggt Claude-Nutzung als operation="instagram-import"', async () => {
    const { logClaudeNutzung } = await import('@/lib/claude-tracking')
    mockClaudeResponse(validResponse)
    await parseRezeptMitClaude('Caption')
    expect(logClaudeNutzung).toHaveBeenCalledWith(
      'instagram-import',
      'claude-sonnet-4-6',
      { input_tokens: 100, output_tokens: 200 }
    )
  })
})
