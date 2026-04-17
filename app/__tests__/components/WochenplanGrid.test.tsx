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
    render(<WochenplanGrid carryOverPlan={null} aktiverPlan={mockPlan} gerichte={mockGerichte} extras={[]} onTauschen={() => {}} onWaehlen={() => {}} onRezept={() => {}} />)
    expect(screen.getByText('Flickerklopse')).toBeInTheDocument()
    expect(screen.getByText('Pizza Margherita')).toBeInTheDocument()
  })

  it('ruft onTauschen auf wenn Tauschen-Button zweimal geklickt wird', () => {
    const onTauschen = jest.fn()
    render(<WochenplanGrid carryOverPlan={null} aktiverPlan={mockPlan} gerichte={mockGerichte} extras={[]} onTauschen={onTauschen} onWaehlen={() => {}} onRezept={() => {}} />)
    const buttons = screen.getAllByLabelText(/tauschen/i)
    fireEvent.click(buttons[0])
    fireEvent.click(screen.getAllByLabelText(/zufällig tauschen/i)[0])
    expect(onTauschen).toHaveBeenCalled()
  })

  it('zeigt keinen Genehmigen-Button im Grid', () => {
    render(<WochenplanGrid carryOverPlan={null} aktiverPlan={mockPlan} gerichte={mockGerichte} extras={[]} onTauschen={() => {}} onWaehlen={() => {}} onRezept={() => {}} />)
    expect(screen.queryByText(/plan genehmigen/i)).not.toBeInTheDocument()
  })
})
