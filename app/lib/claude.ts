import Anthropic from '@anthropic-ai/sdk'
import type { FamilieMitglied, Gericht, WochenplanEintrag, DrinkVorschlag } from '@/types'

export interface WochenplanGenerierungErgebnis {
  mahlzeiten: Omit<WochenplanEintrag, 'gericht_id'>[]
  drinks: DrinkVorschlag[]
}

export async function generiereWochenplan(
  profile: FamilieMitglied[],
  gerichte: Gericht[]
): Promise<WochenplanGenerierungErgebnis> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const profilText = profile.map(p =>
    `- ${p.name} (${p.alter ? p.alter + ' Jahre' : 'Erwachsen'}): mag ${p.lieblingsgerichte.slice(0, 5).join(', ')}; mag nicht: ${p.abneigungen.join(', ')}`
  ).join('\n')

  const gerichteText = gerichte.map(g =>
    `- ${g.name} (${g.gesund ? 'gesund' : 'nicht gesund'}, Kategorie: ${g.kategorie})`
  ).join('\n')

  const obstListe = profile
    .flatMap(p => p.lieblingsobst)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8)
    .join(', ')

  const prompt = `Du bist Jarvis, ein Haushaltsassistent für eine deutsche Familie.

Erstelle einen Wochenplan für Montag bis Sonntag mit je Mittag und Abend (14 Einträge gesamt).

Familienprofile:
${profilText}

Verfügbare Gerichte:
${gerichteText}

Regeln:
- Wähle NUR Gerichte aus der obigen Liste
- Ca. 70% bekannte Lieblingsgerichte, 30% gesündere Optionen
- Keine Wiederholungen innerhalb einer Woche
- Abwechslungsreiche Kategorien (nicht jeden Tag Nudeln)
- Berücksichtige die Abneigungen aller Familienmitglieder
- Füge am Ende 3 Saft-/Drink-Vorschläge für den Entsafter hinzu (basierend auf Lieblingsobst: ${obstListe})

Antworte NUR mit diesem JSON, kein weiterer Text:
{
  "mahlzeiten": [
    {"tag": "montag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "montag", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "dienstag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "dienstag", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "mittwoch", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "mittwoch", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "donnerstag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "donnerstag", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "freitag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "freitag", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "samstag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "samstag", "mahlzeit": "abend", "gericht_name": "..."},
    {"tag": "sonntag", "mahlzeit": "mittag", "gericht_name": "..."},
    {"tag": "sonntag", "mahlzeit": "abend", "gericht_name": "..."}
  ],
  "drinks": [
    {"name": "...", "zutaten": ["...", "..."]},
    {"name": "...", "zutaten": ["...", "..."]},
    {"name": "...", "zutaten": ["...", "..."]}
  ]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const parsed = JSON.parse(text)
  return {
    mahlzeiten: parsed.mahlzeiten ?? [],
    drinks: parsed.drinks ?? []
  }
}
