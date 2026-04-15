import { supabase } from '@/lib/supabase-server'
import type { Gericht, Wochenplan, WochenplanEintrag } from '@/types'

export function getMontag(datum: Date = new Date()): Date {
  const d = new Date(datum)
  const tag = d.getDay() // 0 = Sonntag, 1 = Montag, ...
  const diff = tag === 0 ? -6 : 1 - tag
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function erstelleWochenplanEintraege(
  claudeAntwort: Omit<WochenplanEintrag, 'gericht_id'>[],
  gerichte: Gericht[]
): WochenplanEintrag[] {
  return claudeAntwort
    .map(eintrag => {
      const gericht = gerichte.find(g => g.name === eintrag.gericht_name)
      if (!gericht) return null
      return { ...eintrag, gericht_id: gericht.id }
    })
    .filter((e): e is WochenplanEintrag => e !== null)
}

export async function ladeAktuellenWochenplan(): Promise<Wochenplan | null> {
  const montag = getMontag().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('wochenplaene')
    .select('*')
    .eq('woche_start', montag)
    .single()
  if (error || !data) return null
  return data as Wochenplan
}

export async function speichereWochenplan(
  eintraege: WochenplanEintrag[],
  status: 'entwurf' | 'genehmigt' = 'entwurf'
): Promise<Wochenplan> {
  const montag = getMontag().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('wochenplaene')
    .upsert({ woche_start: montag, eintraege, status }, { onConflict: 'woche_start' })
    .select()
    .single()
  if (error) throw error
  return data as Wochenplan
}
