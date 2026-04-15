import { getMontag, getLetztenFreitag, getAktivenMontag } from '@/lib/datum-utils'

describe('getMontag', () => {
  it('gibt den Montag der aktuellen Woche zurück wenn Dienstag', () => {
    const dienstag = new Date('2026-04-14T10:00:00')
    const montag = getMontag(dienstag)
    expect(montag.getFullYear()).toBe(2026)
    expect(montag.getMonth()).toBe(3) // April = 3
    expect(montag.getDate()).toBe(13)
  })

  it('gibt denselben Tag zurück wenn schon Montag', () => {
    const montag = new Date('2026-04-13T10:00:00')
    expect(getMontag(montag).getDate()).toBe(13)
  })

  it('gibt den vorherigen Montag zurück wenn Sonntag', () => {
    const sonntag = new Date('2026-04-19T10:00:00')
    expect(getMontag(sonntag).getDate()).toBe(13)
  })
})

describe('getLetztenFreitag', () => {
  it('gibt heute zurück wenn heute Freitag', () => {
    const freitag = new Date('2026-04-17T10:00:00')
    expect(getLetztenFreitag(freitag).getDate()).toBe(17)
  })

  it('gibt letzten Freitag zurück wenn heute Donnerstag', () => {
    const donnerstag = new Date('2026-04-16T10:00:00')
    expect(getLetztenFreitag(donnerstag).getDate()).toBe(10)
  })

  it('gibt letzten Freitag zurück wenn heute Samstag', () => {
    const samstag = new Date('2026-04-18T10:00:00')
    expect(getLetztenFreitag(samstag).getDate()).toBe(17)
  })

  it('gibt letzten Freitag zurück wenn heute Sonntag', () => {
    const sonntag = new Date('2026-04-19T10:00:00')
    expect(getLetztenFreitag(sonntag).getDate()).toBe(17)
  })

  it('gibt letzten Freitag zurück wenn heute Montag', () => {
    const montag = new Date('2026-04-20T10:00:00')
    expect(getLetztenFreitag(montag).getDate()).toBe(17)
  })
})

describe('getAktivenMontag', () => {
  it('gibt nächsten Montag zurück wenn heute Freitag', () => {
    const freitag = new Date('2026-04-17T10:00:00')
    expect(getAktivenMontag(freitag).getDate()).toBe(20) // Mo 20.04.
  })

  it('gibt Montag der laufenden Woche zurück wenn heute Donnerstag', () => {
    const donnerstag = new Date('2026-04-16T10:00:00')
    expect(getAktivenMontag(donnerstag).getDate()).toBe(13) // Mo 13.04.
  })

  it('gibt nächsten Montag zurück wenn heute Samstag nach dem neuen Plan-Freitag', () => {
    const samstag = new Date('2026-04-18T10:00:00')
    expect(getAktivenMontag(samstag).getDate()).toBe(20) // Mo 20.04.
  })
})
