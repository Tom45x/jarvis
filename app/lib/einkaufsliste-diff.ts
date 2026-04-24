import type { EinfrierStatus } from '@/types'

export function bestimmeEinfrierstatus(
  jetzt: Date,
  einkaufstag1: number,
  einkaufstag2: number,
  picnicBestellt: boolean
): EinfrierStatus {
  const tag = jetzt.getDay() === 0 ? 7 : jetzt.getDay()
  return {
    picnicFrozen: picnicBestellt,
    bring1Frozen: tag >= einkaufstag1,
    bring2Frozen: tag >= einkaufstag2,
  }
}
