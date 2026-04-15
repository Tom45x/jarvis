// Berechnet den Montag der Woche, die 'datum' enthält (ISO-Woche: Mo–So)
export function getMontag(datum: Date = new Date()): Date {
  const d = new Date(datum)
  const tag = d.getDay() // 0=So, 1=Mo, ..., 6=Sa
  const diff = tag === 0 ? -6 : 1 - tag
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Berechnet den letzten Freitag relativ zu 'datum'
// Wenn 'datum' selbst ein Freitag ist, wird 'datum' zurückgegeben
export function getLetztenFreitag(datum: Date = new Date()): Date {
  const d = new Date(datum)
  d.setHours(0, 0, 0, 0)
  const tag = d.getDay() // 0=So, 1=Mo, ..., 5=Fr, 6=Sa
  const daysBack = (tag + 2) % 7  // Fr→0, Sa→1, So→2, Mo→3, Di→4, Mi→5, Do→6
  d.setDate(d.getDate() - daysBack)
  return d
}

// Berechnet den Montag der Woche NACH dem letzten Freitag
// Das ist der woche_start des aktiven Plans (der Plan für den Katja freitags einkauft)
export function getAktivenMontag(datum: Date = new Date()): Date {
  const letzterFreitag = getLetztenFreitag(datum)
  const montag = getMontag(letzterFreitag)
  const aktiverMontag = new Date(montag)
  aktiverMontag.setDate(montag.getDate() + 7)
  return aktiverMontag
}
