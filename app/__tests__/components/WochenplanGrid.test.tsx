import { render, screen, fireEvent } from '@testing-library/react'
import { WochenplanGrid } from '@/components/WochenplanGrid'
import type { Wochenplan, Gericht } from '@/types'

const mockPlan: Wochenplan = {
  id: '1',
  woche_start: '2026-04-13',
  status: 'entwurf',
  erstellt_am: new Date().toISOString(),
  eintraege: [
    { tag: 'montag', mahlzeit: 'mittag', gericht_id: 'g1', gericht_name: 'Flickerklopse' },
    { tag: 'montag', mahlzeit: 'abend', gericht_id: 'g2', gericht_name: 'Pizza Margherita' },
  ]
}

const mockGerichte: Gericht[] = [
  { id: 'g1', name: 'Flickerklopse', zutaten: [], gesund: false, kategorie: 'fleisch', beliebtheit: {}, quelle: 'manuell' },
  { id: 'g2', name: 'Pizza Margherita', zutaten: [], gesund: false, kategorie: 'sonstiges', beliebtheit: {}, quelle: 'manuell' },
]

describe('WochenplanGrid', () => {
  it('zeigt Gerichte des Plans an', () => {
    render(<WochenplanGrid plan={mockPlan} gerichte={mockGerichte} onTauschen={() => {}} onGenehmigen={() => {}} />)
    expect(screen.getByText('Flickerklopse')).toBeInTheDocument()
    expect(screen.getByText('Pizza Margherita')).toBeInTheDocument()
  })

  it('ruft onTauschen auf wenn Tauschen-Button geklickt wird', () => {
    const onTauschen = jest.fn()
    render(<WochenplanGrid plan={mockPlan} gerichte={mockGerichte} onTauschen={onTauschen} onGenehmigen={() => {}} />)
    fireEvent.click(screen.getAllByText('Tauschen')[0])
    expect(onTauschen).toHaveBeenCalledWith('montag', 'mittag')
  })

  it('zeigt Genehmigen-Button bei Entwurf-Status', () => {
    render(<WochenplanGrid plan={mockPlan} gerichte={mockGerichte} onTauschen={() => {}} onGenehmigen={() => {}} />)
    expect(screen.getByText(/genehmigen/i)).toBeInTheDocument()
  })

  it('zeigt keinen Genehmigen-Button bei genehmigtem Plan', () => {
    const genehmigterPlan = { ...mockPlan, status: 'genehmigt' as const }
    render(<WochenplanGrid plan={genehmigterPlan} gerichte={mockGerichte} onTauschen={() => {}} onGenehmigen={() => {}} />)
    expect(screen.queryByText(/genehmigen/i)).not.toBeInTheDocument()
  })

  it('ruft onGenehmigen auf wenn Genehmigen-Button geklickt wird', () => {
    const onGenehmigen = jest.fn()
    render(<WochenplanGrid plan={mockPlan} gerichte={mockGerichte} onTauschen={() => {}} onGenehmigen={onGenehmigen} />)
    fireEvent.click(screen.getByText(/genehmigen/i))
    expect(onGenehmigen).toHaveBeenCalled()
  })
})
