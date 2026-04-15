import Anthropic from '@anthropic-ai/sdk'
import type { FamilieMitglied, Gericht, WochenplanEintrag } from '@/types'

export interface WochenplanGenerierungErgebnis {
  mahlzeiten: Omit<WochenplanEintrag, 'gericht_id'>[]
}

function mockWochenplan(gerichte: Gericht[]): WochenplanGenerierungErgebnis {
  const normale = gerichte.filter(
    g => g.kategorie !== 'trainingstage' && g.kategorie !== 'frühstück' && g.kategorie !== 'filmabend' && !g.gesperrt
  )
  const shuffle = (arr: Gericht[]) => [...arr].sort(() => Math.random() - 0.5)
  const pool = shuffle(normale)
  const slots: Omit<WochenplanEintrag, 'gericht_id'>[] = [
    { tag: 'montag', mahlzeit: 'mittag', gericht_name: '' },
    { tag: 'dienstag', mahlzeit: 'mittag', gericht_name: '' },
    { tag: 'mittwoch', mahlzeit: 'mittag', gericht_name: '' },
    { tag: 'mittwoch', mahlzeit: 'abend', gericht_name: '' },
    { tag: 'donnerstag', mahlzeit: 'mittag', gericht_name: '' },
    { tag: 'freitag', mahlzeit: 'mittag', gericht_name: '' },
    { tag: 'samstag', mahlzeit: 'mittag', gericht_name: '' },
    { tag: 'samstag', mahlzeit: 'abend', gericht_name: '' },
    { tag: 'sonntag', mahlzeit: 'mittag', gericht_name: '' },
    { tag: 'sonntag', mahlzeit: 'abend', gericht_name: '' },
  ]
  return {
    mahlzeiten: slots.map((slot, i) => ({
      ...slot,
      gericht_name: pool[i % pool.length]?.name ?? 'Unbekannt',
    })),
  }
}

export async function generiereWochenplan(
  profile: FamilieMitglied[],
  gerichte: Gericht[]
): Promise<WochenplanGenerierungErgebnis> {
  if (process.env.CLAUDE_DEV_MODE === 'true') {
    console.log('[claude] DEV_MODE aktiv — Mock-Wochenplan wird verwendet')
    return mockWochenplan(gerichte)
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const profilText = profile.map(p =>
    `- ${p.name} (${p.alter ? p.alter + ' Jahre' : 'Erwachsen'}): mag ${p.lieblingsgerichte.slice(0, 5).join(', ')}; mag nicht: ${p.abneigungen.join(', ')}`
  ).join('\n')

  const normaleGerichte = gerichte.filter(g =>
    g.kategorie !== 'trainingstage' && g.kategorie !== 'frühstück' && g.kategorie !== 'filmabend'
  )

  const gerichteText = normaleGerichte.map(g =>
    `- ${g.name} (${g.gesund ? 'gesund' : 'nicht gesund'}, Kategorie: ${g.kategorie}${g.bewertung === 5 ? ', ⭐⭐⭐⭐⭐ FAVORIT' : g.bewertung === 1 || g.bewertung === 2 ? ', weniger beliebt' : ''})`
  ).join('\n')

  const prompt = `Du bist Jarvis, ein Haushaltsassistent für eine deutsche Familie.

Erstelle einen Wochenplan für Montag bis Sonntag. Deine Aufgabe: NUR die 10 normalen Mahlzeiten wählen (Mittag und Abend, außer Montag/Dienstag/Donnerstag Abend und Freitagabend — die werden separat befüllt).

Familienprofile:
${profilText}

Verfügbare Gerichte:
${gerichteText}

Regeln:
- Wähle NUR Gerichte aus der obigen Liste — exakte Schreibweise beibehalten
- Gerichte mit ⭐⭐⭐⭐⭐ FAVORIT sind Lieblingsgerichte der Familie — mindestens 3 VERSCHIEDENE davon pro Woche einplanen (jedes nur 1x)
- Gerichte mit "weniger beliebt" maximal 1x pro Woche
- Ca. 70% bekannte Lieblingsgerichte, 30% gesündere Optionen
- Keine Wiederholungen innerhalb einer Woche
- Abwechslungsreiche Kategorien (nicht jeden Tag Nudeln)
- Berücksichtige die Abneigungen aller Familienmitglieder

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "mahlzeiten": [
    {"tag": "montag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "dienstag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "mittwoch", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "mittwoch", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "donnerstag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "freitag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "samstag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "samstag", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "sonntag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "sonntag", "mahlzeit": "abend", "gericht_name": "..."}
  ]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  let parsed: { mahlzeiten?: unknown[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Ungültige JSON-Antwort von Claude: ${text.slice(0, 200)}`)
  }

  return {
    mahlzeiten: (parsed.mahlzeiten ?? []) as Omit<WochenplanEintrag, 'gericht_id'>[],
  }
}
