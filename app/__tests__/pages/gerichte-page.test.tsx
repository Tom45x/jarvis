import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GerichtePage from '@/app/gerichte/page'
import { apiFetch } from '@/lib/api-fetch'

jest.mock('@/lib/api-fetch')
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

function makeResponse(data: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(data) } as unknown as Response
}

beforeEach(() => {
  mockApiFetch.mockResolvedValue(makeResponse([]))
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('Neues Gericht — Button', () => {
  it('zeigt "＋ Neues Gericht hinzufügen" Button', async () => {
    render(<GerichtePage />)
    await waitFor(() => {
      expect(screen.getByText('＋ Neues Gericht hinzufügen')).toBeInTheDocument()
    })
  })

  it('öffnet Formular beim Klick', async () => {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    expect(screen.getByPlaceholderText('Name des Gerichts')).toBeInTheDocument()
  })

  it('versteckt Button wenn Formular offen', async () => {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    expect(screen.queryByText('＋ Neues Gericht hinzufügen')).not.toBeInTheDocument()
  })

  it('schließt Formular per Abbrechen', async () => {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('Abbrechen'))
    expect(screen.queryByPlaceholderText('Name des Gerichts')).not.toBeInTheDocument()
    expect(screen.getByText('＋ Neues Gericht hinzufügen')).toBeInTheDocument()
  })
})

describe('Neues Gericht — Manuell-Pfad', () => {
  async function oeffneFormular() {
    render(<GerichtePage />)
    await waitFor(() => screen.getByText('＋ Neues Gericht hinzufügen'))
    fireEvent.click(screen.getByText('＋ Neues Gericht hinzufügen'))
  }

  it('zeigt Kategorie-Dropdown nach Klick auf Manuell', async () => {
    await oeffneFormular()
    fireEvent.click(screen.getByText('✍️ Manuell'))
    expect(screen.getByDisplayValue('sonstiges')).toBeInTheDocument()
  })

  it('zeigt Aufwand-Dropdown nach Klick auf Manuell', async () => {
    await oeffneFormular()
    fireEvent.click(screen.getByText('✍️ Manuell'))
    expect(screen.getByDisplayValue('30 Min')).toBeInTheDocument()
  })

  it('Speichern-Button ist deaktiviert wenn Name leer', async () => {
    await oeffneFormular()
    fireEvent.click(screen.getByText('✍️ Manuell'))
    expect(screen.getByText('Speichern')).toBeDisabled()
  })

  it('manuell: POST /api/gerichte mit korrekten Daten', async () => {
    const neuesGericht = { id: '99', name: 'Testgericht', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell', aufwand: '30 Min', bewertung: 3, tausch_count: 0, gesperrt: false }
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/gerichte' && opts?.method === 'POST')
        return Promise.resolve(makeResponse(neuesGericht))
      return Promise.resolve(makeResponse([]))
    })

    await oeffneFormular()
    fireEvent.change(screen.getByPlaceholderText('Name des Gerichts'), { target: { value: 'Testgericht' } })
    fireEvent.click(screen.getByText('✍️ Manuell'))
    fireEvent.click(screen.getByText('Speichern'))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/gerichte', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Testgericht', kategorie: 'sonstiges', aufwand: '30 Min', gesund: false, quelle: 'manuell' }),
      }))
    })
  })

  it('manuell: Formular schließt sich nach erfolgreichem Speichern', async () => {
    const neuesGericht = { id: '99', name: 'Testgericht', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell', aufwand: '30 Min', bewertung: 3, tausch_count: 0, gesperrt: false }
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/gerichte' && opts?.method === 'POST')
        return Promise.resolve(makeResponse(neuesGericht))
      return Promise.resolve(makeResponse([]))
    })

    await oeffneFormular()
    fireEvent.change(screen.getByPlaceholderText('Name des Gerichts'), { target: { value: 'Testgericht' } })
    fireEvent.click(screen.getByText('✍️ Manuell'))
    fireEvent.click(screen.getByText('Speichern'))

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Name des Gerichts')).not.toBeInTheDocument()
    })
  })
})
