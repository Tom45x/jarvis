import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const profile = [
  {
    name: 'Ben',
    alter: 11,
    lieblingsgerichte: [
      'Chicken Wings mit Pommes', 'Döner mit Dönersauce', 'Burger mit Pommes',
      'Pizza Margherita', 'Mini Pizzen', 'Flickerklopse', 'Bauernfrühstück',
      'Pfannekuchen', 'Englisches Frühstück', 'Brotzeit', 'Nachos mit Käse',
      'Raclette', 'Spaghetti mit Basilikum Pesto', 'Gegrillte Bauchscheiben',
      'Folienkartoffel vom Grill'
    ],
    abneigungen: ['Rotkohl', 'Brokkoli', 'Blumenkohl'],
    lieblingsobst: ['Erdbeere', 'Wassermelone', 'Honigmelone', 'Zuckermelone', 'Apfel', 'Himbeeren', 'Kirschen'],
    lieblingsgemuese: ['Paprika roh', 'Gurke roh', 'Tomate roh', 'Erbsen', 'Möhren', 'Mais'],
    notizen: 'Fußballer (U11 Torwart BVB), Gymnasium Filder Benden Moers. Kohlrabi nur roh OK.'
  },
  {
    name: 'Marie',
    alter: 8,
    lieblingsgerichte: [],
    abneigungen: [],
    lieblingsobst: [],
    lieblingsgemuese: [],
    notizen: 'Thai-Boxen seit 7. Lebensjahr. Eschenburg Grundschule Moers, 2. Klasse. Profil noch ergänzen!'
  },
  {
    name: 'Thomas',
    alter: 46,
    lieblingsgerichte: [
      'Linseneintopf', 'Chicken Tikka Masala', 'Reis mit Mais und Hühnchen',
      'Apfel-Pfannekuchen', 'Sushi', 'Gegrillte Bauchscheiben', 'Wolfsbarsch',
      'Basilikumpesto', 'Speck mit Rührei', 'Englisches Frühstück'
    ],
    abneigungen: ['Rosenkohl', 'Blumenkohl', 'sehr fettiges Fleisch', 'Weißer Spargel'],
    lieblingsobst: ['Mango', 'Erdbeeren', 'Honigmelone', 'Zuckermelone'],
    lieblingsgemuese: ['Mais', 'Linsen', 'Kohlrabi roh', 'Grüner Spargel (nur Spitzen)'],
    notizen: 'Sitzt viel, kaum Sport. Kartoffeln mit Spinat und Ei geht auch.'
  },
  {
    name: 'Katja',
    alter: null,
    lieblingsgerichte: [],
    abneigungen: [],
    lieblingsobst: [],
    lieblingsgemuese: [],
    notizen: 'Primäre Jarvis-Nutzerin. Profil noch ergänzen!'
  }
]

const gerichte = [
  { name: 'Rösti mit Apfelmus', kategorie: 'sonstiges', gesund: false },
  { name: 'Nudeln mit Butter', kategorie: 'nudeln', gesund: false },
  { name: 'Fischstäbchen mit Kartoffeln und Erbsen', kategorie: 'fisch', gesund: false },
  { name: 'Risibisi', kategorie: 'sonstiges', gesund: true },
  { name: 'Flickerklopse', kategorie: 'fleisch', gesund: false },
  { name: 'Pizza Margherita', kategorie: 'sonstiges', gesund: false },
  { name: 'Lasagne', kategorie: 'nudeln', gesund: false },
  { name: 'Pfannekuchen', kategorie: 'sonstiges', gesund: false },
  { name: 'Raclette', kategorie: 'sonstiges', gesund: false },
  { name: 'Wraps', kategorie: 'sonstiges', gesund: false },
  { name: 'Frikadellen', kategorie: 'fleisch', gesund: false },
  { name: 'Steak mit Pommes und Mais', kategorie: 'fleisch', gesund: false },
  { name: 'Schweinefilet mit Süßkartoffelpüree', kategorie: 'fleisch', gesund: false },
  { name: 'Züricher Geschnetzeltes', kategorie: 'fleisch', gesund: false },
  { name: 'Bratwurst mit Kohlrabi und Kartoffelpüree', kategorie: 'fleisch', gesund: false },
  { name: 'Bratwurst mit Möhren und Kartoffeln', kategorie: 'fleisch', gesund: false },
  { name: 'Leberkäs', kategorie: 'fleisch', gesund: false },
  { name: 'Hühnchenbrust mit Broccoli', kategorie: 'fleisch', gesund: true },
  { name: 'Burger und Pommes', kategorie: 'fleisch', gesund: false },
  { name: 'Hühnchenbrust mit Mais und Reis', kategorie: 'fleisch', gesund: true },
  { name: 'Schnitzel mit Kartoffeln', kategorie: 'fleisch', gesund: false },
  { name: 'Gegrillte Bauchscheiben', kategorie: 'fleisch', gesund: false },
  { name: 'Spaghetti mit Garnelen', kategorie: 'nudeln', gesund: false },
  { name: 'Spaghetti Bolognese', kategorie: 'nudeln', gesund: false },
  { name: 'Tortellini a la Panna', kategorie: 'nudeln', gesund: false },
  { name: 'Maccaroni mit Spinat', kategorie: 'nudeln', gesund: true },
  { name: 'Schinkennudeln', kategorie: 'nudeln', gesund: false },
  { name: 'Spaghetti mit Basilikum Pesto', kategorie: 'nudeln', gesund: false },
  { name: 'Möhren-Ingwer-Suppe', kategorie: 'suppe', gesund: true },
  { name: 'Gemüsesuppe', kategorie: 'suppe', gesund: true },
  { name: 'Chili con Carne', kategorie: 'suppe', gesund: false },
  { name: 'Linseneintopf', kategorie: 'suppe', gesund: true },
  { name: 'Weiße Bohnensuppe', kategorie: 'suppe', gesund: true },
  { name: 'Hühnersuppe', kategorie: 'suppe', gesund: true },
  { name: 'Spätzle mit Hühnchen', kategorie: 'auflauf', gesund: false },
  { name: 'Zucchini-Hack-Auflauf', kategorie: 'auflauf', gesund: false },
  { name: 'Garnelen', kategorie: 'fisch', gesund: true },
  { name: 'Gegrillte Dorade', kategorie: 'fisch', gesund: true },
  { name: 'Wolfsbarsch', kategorie: 'fisch', gesund: true },
  { name: 'Fisch mit Senfsauce und Kartoffeln', kategorie: 'fisch', gesund: true },
  { name: 'Salat mit Putenbrust', kategorie: 'salat', gesund: true },
  { name: 'Salat mit Ziegenkäse', kategorie: 'salat', gesund: true },
  { name: 'Salat mit Bratkartoffeln und Spiegelei', kategorie: 'salat', gesund: true },
  { name: 'Bauernfrühstück', kategorie: 'sonstiges', gesund: false },
  { name: 'Massaman Curry', kategorie: 'sonstiges', gesund: false },
  { name: 'Bruschetta', kategorie: 'sonstiges', gesund: false },
  { name: 'Thai Curry', kategorie: 'sonstiges', gesund: false },
  { name: 'Chicken Tikka Masala', kategorie: 'sonstiges', gesund: false },
  { name: 'Englisches Frühstück', kategorie: 'sonstiges', gesund: false },
  { name: 'Spinat mit Kartoffeln und Ei', kategorie: 'sonstiges', gesund: true },
]

async function seed() {
  console.log('Seeding familie_profile...')
  const { error: profileError } = await supabase
    .from('familie_profile')
    .upsert(profile, { onConflict: 'name' })
  if (profileError) throw profileError
  console.log(`✓ ${profile.length} Profile importiert`)

  console.log('Seeding gerichte...')
  const { error: gerichtError } = await supabase
    .from('gerichte')
    .upsert(gerichte, { onConflict: 'name' })
  if (gerichtError) throw gerichtError
  console.log(`✓ ${gerichte.length} Gerichte importiert`)

  console.log('Seed abgeschlossen.')
}

seed().catch(console.error)
