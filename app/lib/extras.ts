import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase-server'
import { logClaudeNutzung } from '@/lib/claude-tracking'
import type {
  ExtrasKatalogEintrag, ExtrasWochenplanEintrag,
  KindProfil, Naehrstoffe, GapVektor
} from '@/types'

const LEER_NAEHRSTOFFE: Naehrstoffe = {
  protein_g: 0, calcium_mg: 0, eisen_mg: 0, zink_mg: 0,
  'vitamin_a_µg': 0, vitamin_c_mg: 0, 'vitamin_d_µg': 0, 'vitamin_k_µg': 0,
  vitamin_b1_mg: 0, vitamin_b2_mg: 0, vitamin_b6_mg: 0, 'vitamin_b12_µg': 0,
  'folsaeure_µg': 0, omega3_g: 0, magnesium_mg: 0, kalium_mg: 0,
}

export async function ladeExtrasKatalog(): Promise<ExtrasKatalogEintrag[]> {
  const { data, error } = await supabase.from('extras_katalog').select('*')
  if (error) throw error
  return (data ?? []) as ExtrasKatalogEintrag[]
}

export async function ladeKinderProfile(): Promise<KindProfil[]> {
  const { data, error } = await supabase.from('kinder_naehrstoff_profil').select('*')
  if (error) throw error
  return (data ?? []) as KindProfil[]
}

export async function ladeExtrasHistory(wochen = 4): Promise<ExtrasWochenplanEintrag[]> {
  const vonDatum = new Date()
  vonDatum.setDate(vonDatum.getDate() - wochen * 7)

  const { data, error } = await supabase
    .from('extras_wochenplan')
    .select('*')
    .gte('erstellt_am', vonDatum.toISOString())
    .order('erstellt_am', { ascending: false })

  if (error) throw error
  return (data ?? []) as ExtrasWochenplanEintrag[]
}

export async function ladeExtrasForPlan(wochenplanId: string): Promise<ExtrasWochenplanEintrag[]> {
  const { data, error } = await supabase
    .from('extras_wochenplan')
    .select('*, extras_katalog(zubereitung, zutaten)')
    .eq('wochenplan_id', wochenplanId)

  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => {
    const katalog = row.extras_katalog as { zubereitung?: string; zutaten?: Array<{ name: string; menge: number; einheit: string }> } | null
    return {
      ...row,
      extras_katalog: undefined,
      zubereitung: katalog?.zubereitung ?? undefined,
      katalog_zutaten: katalog?.zutaten ?? [],
    }
  }) as unknown as ExtrasWochenplanEintrag[]
}

export async function speichereExtras(
  wochenplanId: string,
  extras: Omit<ExtrasWochenplanEintrag, 'id' | 'erstellt_am'>[]
): Promise<ExtrasWochenplanEintrag[]> {
  await supabase.from('extras_wochenplan').delete().eq('wochenplan_id', wochenplanId)

  const { data, error } = await supabase
    .from('extras_wochenplan')
    .insert(extras.map(e => ({ ...e, wochenplan_id: wochenplanId })))
    .select()

  if (error) throw error
  return (data ?? []) as ExtrasWochenplanEintrag[]
}

function addiereNaehrstoffe(a: Naehrstoffe, b: Naehrstoffe): Naehrstoffe {
  return Object.fromEntries(
    (Object.keys(LEER_NAEHRSTOFFE) as (keyof Naehrstoffe)[]).map(k => [k, (a[k] ?? 0) + (b[k] ?? 0)])
  ) as unknown as Naehrstoffe
}

export function berechneGapVektor(
  history: ExtrasWochenplanEintrag[],
  profile: KindProfil[]
): GapVektor {
  const gesamtWochenbedarf = profile.reduce((acc, kind) => {
    return addiereNaehrstoffe(acc, Object.fromEntries(
      (Object.keys(kind.tagesbedarf) as (keyof Naehrstoffe)[]).map(k => [k, (kind.tagesbedarf[k] ?? 0) * 7])
    ) as unknown as Naehrstoffe)
  }, { ...LEER_NAEHRSTOFFE })

  const wochenMap = new Map<string, Naehrstoffe>()
  for (const entry of history) {
    const wocheKey = entry.erstellt_am.slice(0, 10)
    const existing = wochenMap.get(wocheKey) ?? { ...LEER_NAEHRSTOFFE }
    wochenMap.set(wocheKey, addiereNaehrstoffe(existing, entry.naehrstoffe_snapshot))
  }

  const geliefertSumme = Array.from(wochenMap.values()).reduce(
    (acc, w) => addiereNaehrstoffe(acc, w),
    { ...LEER_NAEHRSTOFFE }
  )
  const anzahlWochen = Math.max(wochenMap.size, 1)

  const geliefertDurchschnitt = Object.fromEntries(
    (Object.keys(LEER_NAEHRSTOFFE) as (keyof Naehrstoffe)[]).map(k => [k, (geliefertSumme[k] ?? 0) / anzahlWochen])
  ) as unknown as Naehrstoffe

  return Object.fromEntries(
    (Object.keys(LEER_NAEHRSTOFFE) as (keyof Naehrstoffe)[]).map(k => {
      const bedarf = gesamtWochenbedarf[k] ?? 1
      const geliefert = geliefertDurchschnitt[k] ?? 0
      const deckung = Math.min(geliefert / bedarf, 1)
      return [k, Math.round((1 - deckung) * 100)]
    })
  ) as GapVektor
}

interface ExtrasGenerierungErgebnis {
  snack_dienstag: { katalog_id: string | null; name: string; begruendung: string; naehrstoffe: Naehrstoffe; ist_neu: boolean }
  snack_donnerstag: { katalog_id: string | null; name: string; begruendung: string; naehrstoffe: Naehrstoffe; ist_neu: boolean }
  saft_samstag: { katalog_id: string | null; name: string; begruendung: string; naehrstoffe: Naehrstoffe; ist_neu: boolean }
}

function mockExtras(katalog: ExtrasKatalogEintrag[]): ExtrasGenerierungErgebnis {
  const snacks = katalog.filter(k => k.typ === 'snack')
  const safte = katalog.filter(k => k.typ === 'saft')
  const snack1 = snacks[0]
  const snack2 = snacks[1] ?? snacks[0]
  const saft = safte[0]
  return {
    snack_dienstag: { katalog_id: snack1?.id ?? null, name: snack1?.name ?? 'Snack', begruendung: 'DEV-Modus', naehrstoffe: snack1?.naehrstoffe ?? { ...LEER_NAEHRSTOFFE }, ist_neu: false },
    snack_donnerstag: { katalog_id: snack2?.id ?? null, name: snack2?.name ?? 'Snack', begruendung: 'DEV-Modus', naehrstoffe: snack2?.naehrstoffe ?? { ...LEER_NAEHRSTOFFE }, ist_neu: false },
    saft_samstag: { katalog_id: saft?.id ?? null, name: saft?.name ?? 'Saft', begruendung: 'DEV-Modus', naehrstoffe: saft?.naehrstoffe ?? { ...LEER_NAEHRSTOFFE }, ist_neu: false },
  }
}

export async function generiereExtras(
  katalog: ExtrasKatalogEintrag[],
  gapVektor: GapVektor,
  history: ExtrasWochenplanEintrag[],
  profile: KindProfil[]
): Promise<ExtrasGenerierungErgebnis> {
  if (process.env.CLAUDE_DEV_MODE === 'true') {
    return mockExtras(katalog)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const aktuellerMonat = new Date().getMonth() + 1

  const letzte4WochenNamen = history.map(e => e.name)
  const katalogJson = JSON.stringify(katalog.map(k => ({
    id: k.id, typ: k.typ, name: k.name, geraet: k.geraet,
    naehrstoffe: k.naehrstoffe, saison: k.saison,
    geschmacks_hinweis: k.geschmacks_hinweis,
    zubereitung: k.zubereitung,
  })))

  const gapText = (Object.keys(gapVektor) as (keyof GapVektor)[])
    .sort((a, b) => (gapVektor[b] ?? 0) - (gapVektor[a] ?? 0))
    .slice(0, 8)
    .map(k => `${k}: ${gapVektor[k]}% Lücke`)
    .join(', ')

  const prompt = `Du bist Jarvis, ein Ernährungsassistent optimiert für Kinder.

Kinderdaten:
${profile.map(p => `- ${p.name}: ${new Date().getFullYear() - new Date(p.geburtsdatum).getFullYear()} Jahre, ${p.gewicht_kg}kg, sehr aktiv`).join('\n')}

Nährstoff-Lücken dieser Woche (je höher der %, desto größer die Lücke):
${gapText}

Aktuelle Saison: Monat ${aktuellerMonat}

In den letzten 4 Wochen verwendet (nicht wiederholen wenn möglich):
${letzte4WochenNamen.join(', ') || 'keine'}

Verfügbarer Katalog (JSON):
${katalogJson}

Wähle 2 Snacks (Dienstag + Donnerstag) und 1 Saft (Samstag):
1. Schließe Items aus, die nicht saisonal passen (saison[] leer = ganzjährig)
2. Bevorzuge Items die die größten Nährstoff-Lücken schließen
3. Vermeide Wiederholungen aus den letzten 4 Wochen
4. Die Kinder mögen keine ungewohnten Geschmäcker — beachte geschmacks_hinweis
5. Snack Di und Do müssen VERSCHIEDEN sein
6. Falls kein Katalog-Item eine Lücke gut abdeckt: erfinde einen neuen Vorschlag (ist_neu: true, katalog_id: null, eigene naehrstoffe schätzen)

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "snack_dienstag": {
    "katalog_id": "uuid-oder-null",
    "name": "Name",
    "begruendung": "max. 60 Zeichen warum dieser Snack",
    "naehrstoffe": { "protein_g": 0, "calcium_mg": 0, "eisen_mg": 0, "zink_mg": 0, "vitamin_a_µg": 0, "vitamin_c_mg": 0, "vitamin_d_µg": 0, "vitamin_k_µg": 0, "vitamin_b1_mg": 0, "vitamin_b2_mg": 0, "vitamin_b6_mg": 0, "vitamin_b12_µg": 0, "folsaeure_µg": 0, "omega3_g": 0, "magnesium_mg": 0, "kalium_mg": 0 },
    "ist_neu": false
  },
  "snack_donnerstag": { "katalog_id": null, "name": "", "begruendung": "", "naehrstoffe": {}, "ist_neu": false },
  "saft_samstag": { "katalog_id": null, "name": "", "begruendung": "", "naehrstoffe": {}, "ist_neu": false }
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  await logClaudeNutzung('extras', 'claude-sonnet-4-6', message.usage)

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let parsed: ExtrasGenerierungErgebnis
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Ungültige JSON-Antwort von Claude (Extras): ${text.slice(0, 200)}`)
  }

  return parsed
}
