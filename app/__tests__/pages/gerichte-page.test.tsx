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
