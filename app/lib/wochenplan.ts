import { supabase } from '@/lib/supabase-server'
import { getMontag, getLetztenFreitag, getAktivenMontag } from '@/lib/datum-utils'
import type { Gericht, Wochenplan, WochenplanEintrag, WochenAnsicht } from '@/types'

export { getMontag, getLetztenFreitag, getAktivenMontag }

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

export async function ladeWochenAnsicht(): Promise<WochenAnsicht> {
  const letzterFreitag = getLetztenFreitag()
  const carryOverMontag = getMontag(letzterFreitag).toISOString().split('T')[0]
  const aktiverMontag = getAktivenMontag().toISOString().split('T')[0]

  const [carryOverResult, aktivResult] = await Promise.all([
    supabase.from('wochenplaene').select('*').eq('woche_start', carryOverMontag).single(),
    supabase.from('wochenplaene').select('*').eq('woche_start', aktiverMontag).single(),
  ])

  return {
    carryOverPlan: carryOverResult.error ? null : (carryOverResult.data as Wochenplan),
    aktiverPlan: aktivResult.error ? null : (aktivResult.data as Wochenplan),
  }
}

export async function speichereWochenplan(
  eintraege: WochenplanEintrag[],
  status: 'entwurf' | 'genehmigt' = 'entwurf'
): Promise<Wochenplan> {
  const montag = getAktivenMontag().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('wochenplaene')
    .upsert({ woche_start: montag, eintraege, status }, { onConflict: 'woche_start' })
    .select()
    .single()
  if (error) throw error
  return data as Wochenplan
}
