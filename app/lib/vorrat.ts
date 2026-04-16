import type { NormierteMenge, VorratEintrag } from '@/types'
import { supabase } from '@/lib/supabase-server'

export function istTracked(haltbarkeitTage: number): boolean {
  return haltbarkeitTage >= 14
}

export function normalisiereEinheit(menge: number, einheit: string): NormierteMenge {
  switch (einheit.toLowerCase().trim()) {
    case 'g':       return { wert: menge,         basis: 'g' }
    case 'kg':      return { wert: menge * 1000,  basis: 'g' }
    case 'ml':      return { wert: menge,          basis: 'ml' }
    case 'l':       return { wert: menge * 1000,  basis: 'ml' }
    case 'cl':      return { wert: menge * 10,    basis: 'ml' }
    case 'tl':      return { wert: menge * 5,     basis: 'g' }
    case 'el':      return { wert: menge * 15,    basis: 'g' }
    default:        return { wert: menge,          basis: 'stueck' }
  }
}

export function parsePaketgroesse(produktName: string): NormierteMenge | null {
  const match = produktName.match(/(\d+(?:[,.]\d+)?)\s*(g|kg|ml|l|cl)\b/i)
  if (!match) return null
  const wert = parseFloat(match[1].replace(',', '.'))
  return normalisiereEinheit(wert, match[2].toLowerCase())
}

export async function ladeVorrat(): Promise<VorratEintrag[]> {
  const { data } = await supabase
    .from('vorrat')
    .select('zutat_name, bestand, einheit_basis')
  return (data ?? []) as VorratEintrag[]
}

export async function aktualisiereVorrat(
  aktuellerVorrat: VorratEintrag[],
  kaeufe: Array<{ zutat_name: string; paket: NormierteMenge | null; verbrauch: NormierteMenge }>,
  ausVorratListe: Array<{ zutat_name: string; verbrauch: NormierteMenge }>
): Promise<void> {
  try {
    const map = new Map<string, VorratEintrag>()
    for (const v of aktuellerVorrat) {
      map.set(v.zutat_name, { ...v })
    }

    for (const kauf of kaeufe) {
      const key = kauf.zutat_name
      const basis = kauf.paket?.basis ?? kauf.verbrauch.basis
      const existing = map.get(key)
      let bestand = existing?.bestand ?? 0

      if (kauf.paket && (!existing || existing.einheit_basis === kauf.paket.basis)) {
        bestand += kauf.paket.wert
      }
      bestand -= kauf.verbrauch.wert
      if (bestand < 0) bestand = 0

      map.set(key, {
        zutat_name: key,
        bestand,
        einheit_basis: existing?.einheit_basis ?? basis,
      })
    }

    for (const av of ausVorratListe) {
      const key = av.zutat_name
      const existing = map.get(key)
      if (!existing) continue
      let bestand = existing.bestand - av.verbrauch.wert
      if (bestand < 0) bestand = 0
      map.set(key, { ...existing, bestand })
    }

    const updates = Array.from(map.values())
    if (updates.length === 0) return

    await supabase
      .from('vorrat')
      .upsert(
        updates.map(v => ({ ...v, aktualisiert_am: new Date().toISOString() })),
        { onConflict: 'zutat_name' }
      )
  } catch {
    // Vorrat-Fehler dürfen nie den Hauptflow unterbrechen
  }
}
