import { bestimmeEinfrierstatus } from '@/lib/einkaufsliste-diff'

describe('bestimmeEinfrierstatus', () => {
  it('Bring-1 ist am Einkaufstag 1 gefroren', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, false)
    expect(status.bring1Frozen).toBe(true)
    expect(status.bring2Frozen).toBe(false)
  })

  it('Bring-1 ist vor Einkaufstag 1 offen', () => {
    const dienstag = new Date('2026-04-14T10:00:00Z')
    const status = bestimmeEinfrierstatus(dienstag, 5, 6, false)
    expect(status.bring1Frozen).toBe(false)
    expect(status.bring2Frozen).toBe(false)
  })

  it('Bring-2 ist am Einkaufstag 2 gefroren', () => {
    const donnerstag = new Date('2026-04-16T10:00:00Z')
    const status = bestimmeEinfrierstatus(donnerstag, 1, 4, false)
    expect(status.bring2Frozen).toBe(true)
  })

  it('Picnic ist gefroren wenn bestellung_erkannt = true', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, true)
    expect(status.picnicFrozen).toBe(true)
  })

  it('Picnic ist offen wenn bestellung_erkannt = false', () => {
    const montag = new Date('2026-04-13T10:00:00Z')
    const status = bestimmeEinfrierstatus(montag, 1, 4, false)
    expect(status.picnicFrozen).toBe(false)
  })

  it('Sonntag liefert Wochenindex 7, nicht 0', () => {
    const sonntag = new Date('2026-04-19T10:00:00Z')
    const status = bestimmeEinfrierstatus(sonntag, 1, 4, false)
    expect(status.bring1Frozen).toBe(true)
    expect(status.bring2Frozen).toBe(true)
  })
})
