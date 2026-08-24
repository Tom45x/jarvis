import { aufwandAusMinuten, parseZutatenMitClaude } from '@/lib/chefkoch-parser'

describe('aufwandAusMinuten', () => {
  it('bucketed auf 15 Min', () => {
    expect(aufwandAusMinuten(10)).toBe('15 Min')
    expect(aufwandAusMinuten(15)).toBe('15 Min')
  })

  it('bucketed auf 30 Min', () => {
    expect(aufwandAusMinuten(16)).toBe('30 Min')
    expect(aufwandAusMinuten(30)).toBe('30 Min')
  })

  it('bucketed auf 45 Min', () => {
    expect(aufwandAusMinuten(31)).toBe('45 Min')
    expect(aufwandAusMinuten(45)).toBe('45 Min')
  })

  it('bucketed auf 60+ Min', () => {
    expect(aufwandAusMinuten(46)).toBe('60+ Min')
    expect(aufwandAusMinuten(180)).toBe('60+ Min')
  })

  it('fällt auf "30 Min" zurück wenn keine Zeit bekannt ist', () => {
    expect(aufwandAusMinuten(null)).toBe('30 Min')
  })
})

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

describe('parseZutatenMitClaude', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  const validResponse = {
    gesund: true,
    zutaten: [
      { name: 'Milch', menge: 300, einheit: 'ml', haltbarkeit_tage: 5 },
      { name: 'Eier', menge: 2, einheit: 'Stück', haltbarkeit_tage: 21 },
    ],
  }

  function mockClaudeResponse(payload: unknown): void {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      usage: { input_tokens: 50, output_tokens: 80 },
    })
  }

  it('parst valide Claude-Antwort', async () => {
    mockClaudeResponse(validResponse)
    const result = await parseZutatenMitClaude(['300 ml Milch', '2 Ei(er), Größe M'])
    expect(result).not.toBeNull()
    expect(result!.gesund).toBe(true)
    expect(result!.zutaten).toHaveLength(2)
  })

  it('droppt Zutaten mit ungültiger Einheit', async () => {
    mockClaudeResponse({
      gesund: false,
      zutaten: [
        { name: 'Milch', menge: 300, einheit: 'ml', haltbarkeit_tage: 5 },
        { name: 'Mystery', menge: 1, einheit: 'Wagenladung', haltbarkeit_tage: 1 },
      ],
    })
    const result = await parseZutatenMitClaude(['300 ml Milch'])
    expect(result!.zutaten).toHaveLength(1)
  })

  it('returnt null bei kaputtem JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'kein json' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const result = await parseZutatenMitClaude(['300 ml Milch'])
    expect(result).toBeNull()
  })

  it('returnt null wenn kein API-Key gesetzt ist', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const result = await parseZutatenMitClaude(['300 ml Milch'])
    expect(result).toBeNull()
  })

  it('loggt Claude-Nutzung als operation="chefkoch-import"', async () => {
    const { logClaudeNutzung } = await import('@/lib/claude-tracking')
    mockClaudeResponse(validResponse)
    await parseZutatenMitClaude(['300 ml Milch'])
    expect(logClaudeNutzung).toHaveBeenCalledWith(
      'chefkoch-import',
      'claude-sonnet-4-6',
      { input_tokens: 50, output_tokens: 80 }
    )
  })
})
