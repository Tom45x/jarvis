import type { Zutat } from '@/types'

export type AufwandWert = '15 Min' | '30 Min' | '45 Min' | '60+ Min'

export const GUELTIGE_AUFWAND: AufwandWert[] = ['15 Min', '30 Min', '45 Min', '60+ Min']
export const GUELTIGE_EINHEITEN = ['g', 'ml', 'Stück', 'EL', 'TL', 'Bund', 'Packung', 'kg', 'l']

export function validiereZutaten(raw: unknown): Zutat[] {
  const arr = Array.isArray(raw) ? raw : []
  return arr.filter((z: unknown): z is Zutat => {
    if (!z || typeof z !== 'object') return false
    const zz = z as Record<string, unknown>
    return typeof zz.name === 'string'
      && typeof zz.menge === 'number'
      && typeof zz.einheit === 'string'
      && GUELTIGE_EINHEITEN.includes(zz.einheit)
      && typeof zz.haltbarkeit_tage === 'number'
  })
}

export function validiereAufwand(raw: unknown, fallback: AufwandWert = '30 Min'): AufwandWert {
  return typeof raw === 'string' && GUELTIGE_AUFWAND.includes(raw as AufwandWert)
    ? raw as AufwandWert
    : fallback
}
