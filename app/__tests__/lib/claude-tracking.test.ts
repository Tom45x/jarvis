import { logClaudeNutzung } from '@/lib/claude-tracking'

// Supabase-Insert mocken
const mockInsert = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: jest.fn(() => ({ insert: mockInsert })),
  },
}))

describe('logClaudeNutzung', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('schreibt korrekten Datensatz für claude-sonnet-4-6', async () => {
    await logClaudeNutzung('wochenplan', 'claude-sonnet-4-6', { input_tokens: 1000, output_tokens: 500 })

    expect(mockInsert).toHaveBeenCalledWith({
      operation: 'wochenplan',
      modell: 'claude-sonnet-4-6',
      input_tokens: 1000,
      output_tokens: 500,
      kosten_usd: (1000 * 3 + 500 * 15) / 1_000_000, // 0.010500
    })
  })

  it('berechnet Kosten für unbekanntes Modell als 0', async () => {
    await logClaudeNutzung('zutaten', 'claude-unbekannt-99', { input_tokens: 100, output_tokens: 100 })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ kosten_usd: 0 })
    )
  })

  it('schluckt Fehler beim Supabase-Insert still', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB down'))

    // Darf keinen Fehler werfen
    await expect(
      logClaudeNutzung('rezept', 'claude-sonnet-4-6', { input_tokens: 100, output_tokens: 100 })
    ).resolves.toBeUndefined()
  })

  it('schluckt Fehler wenn supabase.from wirft', async () => {
    const { supabase } = jest.requireMock('@/lib/supabase-server')
    ;(supabase.from as jest.Mock).mockImplementationOnce(() => { throw new Error('Verbindung verloren') })

    await expect(
      logClaudeNutzung('vorschlaege', 'claude-sonnet-4-6', { input_tokens: 50, output_tokens: 50 })
    ).resolves.toBeUndefined()
  })
})
