import type { PutzRhythmus } from '@/types'

export interface BerlinDatum {
  jahr: number
  monat: number // 1–12
  tag: number
  wochentag: number // 1=Mo … 7=So, wie in einstellungen
}

const WOCHENTAG: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

const berlinFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
})

// Der Server läuft in UTC — Perioden sollen aber nach Katjas Uhr wechseln
export function berlinDatum(jetzt: Date = new Date()): BerlinDatum {
  const teile = Object.fromEntries(berlinFormat.formatToParts(jetzt).map(p => [p.type, p.value]))
  return {
    jahr: Number(teile.year),
    monat: Number(teile.month),
    tag: Number(teile.day),
    wochentag: WOCHENTAG[teile.weekday],
  }
}

// ISO-8601: Die Woche gehört zu dem Jahr, in dem ihr Donnerstag liegt
function isoWoche({ jahr, monat, tag, wochentag }: BerlinDatum): string {
  const donnerstag = new Date(Date.UTC(jahr, monat - 1, tag + 4 - wochentag))
  const wochenJahr = donnerstag.getUTCFullYear()
  const tagImJahr = (donnerstag.getTime() - Date.UTC(wochenJahr, 0, 1)) / 86_400_000
  const woche = Math.floor(tagImJahr / 7) + 1
  return `${wochenJahr}-W${String(woche).padStart(2, '0')}`
}

export function periodenSchluessel(jetzt: Date = new Date()): Record<PutzRhythmus, string> {
  const d = berlinDatum(jetzt)
  return {
    woche: isoWoche(d),
    monat: `${d.jahr}-${String(d.monat).padStart(2, '0')}`,
    quartal: `${d.jahr}-Q${Math.ceil(d.monat / 3)}`,
    jahr: `${d.jahr}`,
  }
}

export function periodeFuer(rhythmus: PutzRhythmus, jetzt: Date = new Date()): string {
  return periodenSchluessel(jetzt)[rhythmus]
}
