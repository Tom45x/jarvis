import { supabase } from '@/lib/supabase-server'
import type {
  Einkaufsliste,
  EinkaufslisteSyncFehler,
  EinkaufslisteSnapshot,
  EinkaufsItem,
  PicnicListenArtikel,
} from '@/types'

export async function ladeListe(wochenplanId: string): Promise<Einkaufsliste | null> {
  const { data, error } = await supabase
    .from('einkaufslisten')
    .select('*')
    .eq('wochenplan_id', wochenplanId)
    .maybeSingle()
  if (error) throw error
  return (data as Einkaufsliste) ?? null
}

export interface UpsertListeInput {
  wochenplan_id: string
  picnic: PicnicListenArtikel[]
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
  aus_vorrat: EinkaufsItem[]
  gestrichen?: string[]
}

export async function upsertListe(input: UpsertListeInput): Promise<Einkaufsliste> {
  const { data, error } = await supabase
    .from('einkaufslisten')
    .upsert(
      {
        wochenplan_id: input.wochenplan_id,
        picnic: input.picnic,
        bring1: input.bring1,
        bring2: input.bring2,
        aus_vorrat: input.aus_vorrat,
        gestrichen: input.gestrichen ?? [],
      },
      { onConflict: 'wochenplan_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data as Einkaufsliste
}

export async function aktualisiereSektionen(
  wochenplanId: string,
  patch: Partial<Pick<Einkaufsliste, 'picnic' | 'bring1' | 'bring2' | 'aus_vorrat'>>
): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update(patch)
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function setzeGestrichen(wochenplanId: string, gestrichen: string[]): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update({ gestrichen })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function markiereAlsGesendet(
  wochenplanId: string,
  snapshot: EinkaufslisteSnapshot
): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update({
      gesendet_am: new Date().toISOString(),
      gesendet_snapshot: snapshot,
      sync_fehler: null,
    })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function setzeSyncFehler(
  wochenplanId: string,
  fehler: EinkaufslisteSyncFehler | null
): Promise<void> {
  const { error } = await supabase
    .from('einkaufslisten')
    .update({ sync_fehler: fehler })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}

export async function aktualisiereSnapshotTeilweise(
  wochenplanId: string,
  current: EinkaufslisteSnapshot,
  patch: Partial<EinkaufslisteSnapshot>
): Promise<void> {
  const snapshot = { ...current, ...patch }
  const { error } = await supabase
    .from('einkaufslisten')
    .update({ gesendet_snapshot: snapshot })
    .eq('wochenplan_id', wochenplanId)
  if (error) throw error
}
