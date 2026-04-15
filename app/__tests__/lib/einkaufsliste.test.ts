import {
  generiereEinkaufslisten,
  tagZuWochenindex,
  aggregiere,
  istGrundvorrat,
  istInRegelbedarf,
} from '@/lib/einkaufsliste'
import type { Gericht, WochenplanEintrag, Zutat } from '@/types'

const hackfleisch: Zutat = { name: 'Hackfleisch', menge: 500, einheit: 'g', haltbarkeit_tage: 2 }
const nudeln: Zutat = { name: 'Nudeln', menge: 400, einheit: 'g', haltbarkeit_tage: 365 }
const zwiebeln: Zutat = { name: 'Zwiebeln', menge: 2, einheit: 'Stück', haltbarkeit_tage: 14 }
const kaese: Zutat = { name: 'Parmesan', menge: 50, einheit: 'g', haltbarkeit_tage: 14 }

const bolognese: Gericht = {
  id: 'g1', name: 'Spaghetti Bolognese', gesund: false, kategorie: 'nudeln',
  beliebtheit: {}, quelle: 'manuell',
  zutaten: [hackfleisch, nudeln, zwiebeln, kaese]
}

const chickenWings: Gericht = {
  id: 'g2', name: 'Chicken Wings mit Pommes', gesund: false, kategorie: 'fleisch',
  beliebtheit: {}, quelle: 'manuell',
  zutaten: [
    { name: 'Chicken Wings', menge: 1000, einheit: 'g', haltbarkeit_tage: 2 },
    { name: 'Pommes', menge: 500, einheit: 'g', haltbarkeit_tage: 30 }
  ]
}

describe('istGrundvorrat', () => {
  it('erkennt typische Grundvorräte', () => {
    expect(istGrundvorrat('Salz')).toBe(true)
    expect(istGrundvorrat('Schwarzer Pfeffer')).toBe(true)
    expect(istGrundvorrat('Olivenöl')).toBe(true)
    expect(istGrundvorrat('Weizenmehl')).toBe(true)
    expect(istGrundvorrat('Zwiebeln')).toBe(true)
    expect(istGrundvorrat('Knoblauchzehen')).toBe(true)
    expect(istGrundvorrat('Paprikapulver')).toBe(true)
  })

  it('filtert keine Nicht-Grundvorräte heraus', () => {
    expect(istGrundvorrat('Hackfleisch')).toBe(false)
    expect(istGrundvorrat('Nudeln')).toBe(false)
    expect(istGrundvorrat('Parmesan')).toBe(false)
    expect(istGrundvorrat('Chicken Wings')).toBe(false)
  })
})

describe('istInRegelbedarf', () => {
  const regelbedarf = ['Butter', 'Milch', 'Eier']

  it('erkennt exakte Treffer', () => {
    expect(istInRegelbedarf('Butter', regelbedarf)).toBe(true)
    expect(istInRegelbedarf('Milch', regelbedarf)).toBe(true)
  })

  it('erkennt Teilstring-Treffer in beide Richtungen', () => {
    expect(istInRegelbedarf('frische Butter', regelbedarf)).toBe(true)
    expect(istInRegelbedarf('Ei', ['Eier'])).toBe(true)
  })

  it('schlägt nicht an bei unbekannten Zutaten', () => {
    expect(istInRegelbedarf('Hackfleisch', regelbedarf)).toBe(false)
    expect(istInRegelbedarf('Parmesan', regelbedarf)).toBe(false)
  })
})

describe('tagZuWochenindex', () => {
  it('gibt 1 für montag zurück', () => expect(tagZuWochenindex('montag')).toBe(1))
  it('gibt 7 für sonntag zurück', () => expect(tagZuWochenindex('sonntag')).toBe(7))
  it('gibt 4 für donnerstag zurück', () => expect(tagZuWochenindex('donnerstag')).toBe(4))
})

describe('aggregiere', () => {
  it('summiert gleiche Zutaten mit gleicher Einheit', () => {
    const items = [
      { name: 'Hackfleisch', menge: 500, einheit: 'g' },
      { name: 'Hackfleisch', menge: 300, einheit: 'g' },
    ]
    const result = aggregiere(items)
    expect(result).toHaveLength(1)
    expect(result[0].menge).toBe(800)
  })

  it('trennt Zutaten mit unterschiedlichen Einheiten', () => {
    const items = [
      { name: 'Milch', menge: 500, einheit: 'ml' },
      { name: 'Milch', menge: 1, einheit: 'l' },
    ]
    const result = aggregiere(items)
    expect(result).toHaveLength(2)
  })
})

describe('generiereEinkaufslisten', () => {
  const einkaufstag2 = 4 // Donnerstag

  it('legt langlebige Zutaten (>=5 Tage) immer in Einkauf 1', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'samstag', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese], einkaufstag2)
    expect(einkauf1.find(i => i.name === 'Nudeln')).toBeTruthy()
    expect(einkauf2.find(i => i.name === 'Nudeln')).toBeUndefined()
    // Zwiebeln sind Grundvorrat — nicht auf der Einkaufsliste
    expect(einkauf1.find(i => i.name === 'Zwiebeln')).toBeUndefined()
  })

  it('legt kurzlebige Zutaten in Einkauf 1 wenn Gericht vor Einkaufstag 2', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese], einkaufstag2)
    expect(einkauf1.find(i => i.name === 'Hackfleisch')).toBeTruthy()
    expect(einkauf2.find(i => i.name === 'Hackfleisch')).toBeUndefined()
  })

  it('legt kurzlebige Zutaten in Einkauf 2 wenn Gericht ab Einkaufstag 2', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'freitag', mahlzeit: 'abend', gericht_id: 'g2', gericht_name: 'Chicken Wings mit Pommes' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [chickenWings], einkaufstag2)
    expect(einkauf2.find(i => i.name === 'Chicken Wings')).toBeTruthy()
    expect(einkauf1.find(i => i.name === 'Pommes')).toBeTruthy()
  })

  it('überspringt Reste-Einträge und verdoppelt Menge beim Basis-Gericht', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' },
      { tag: 'donnerstag', mahlzeit: 'mittag', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese (Reste)' }
    ]
    const { einkauf1 } = generiereEinkaufslisten(eintraege, [bolognese], einkaufstag2)
    const hackfleischE1 = einkauf1.find(i => i.name === 'Hackfleisch')
    expect(hackfleischE1?.menge).toBe(1000)
    expect(einkauf1.find(i => i.name === 'Nudeln')?.menge).toBe(800)
  })

  it('aggregiert gleiche kurzlebige Zutat die in beiden Hälften vorkommt in getrennte Listen', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' },
      { tag: 'freitag', mahlzeit: 'abend', gericht_id: 'g2', gericht_name: 'Chicken Wings mit Pommes' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese, chickenWings], einkaufstag2)
    expect(einkauf1.find(i => i.name === 'Hackfleisch')).toBeTruthy()
    expect(einkauf2.find(i => i.name === 'Chicken Wings')).toBeTruthy()
  })

  it('gibt leere Listen zurück wenn kein Wochenplan', () => {
    const { einkauf1, einkauf2 } = generiereEinkaufslisten([], [bolognese], einkaufstag2)
    expect(einkauf1).toHaveLength(0)
    expect(einkauf2).toHaveLength(0)
  })

  it('filtert Grundvorräte aus der Einkaufsliste heraus', () => {
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' }
    ]
    const { einkauf1 } = generiereEinkaufslisten(eintraege, [bolognese], einkaufstag2)
    expect(einkauf1.find(i => i.name === 'Zwiebeln')).toBeUndefined()
    expect(einkauf1.find(i => i.name === 'Hackfleisch')).toBeTruthy()
    expect(einkauf1.find(i => i.name === 'Parmesan')).toBeTruthy()
  })

  it('filtert Regelbedarf-Zutaten aus der Einkaufsliste heraus', () => {
    const gerichtMitButter: Gericht = {
      id: 'g4', name: 'Pfannkuchen', gesund: false, kategorie: 'frühstück',
      beliebtheit: {}, quelle: 'manuell',
      zutaten: [
        { name: 'Butter', menge: 30, einheit: 'g', haltbarkeit_tage: 14 },
        { name: 'Mehl', menge: 200, einheit: 'g', haltbarkeit_tage: 365 },
        { name: 'Schinken', menge: 100, einheit: 'g', haltbarkeit_tage: 3 },
      ]
    }
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g4', gericht_name: 'Pfannkuchen' }
    ]
    const { einkauf1 } = generiereEinkaufslisten(eintraege, [gerichtMitButter], einkaufstag2, ['Butter', 'Milch'])
    // Butter im Regelbedarf → nicht auf Liste; Mehl ist Grundvorrat → nicht auf Liste
    expect(einkauf1.find(i => i.name === 'Butter')).toBeUndefined()
    expect(einkauf1.find(i => i.name === 'Mehl')).toBeUndefined()
    // Schinken ist weder Grundvorrat noch Regelbedarf → auf Liste
    expect(einkauf1.find(i => i.name === 'Schinken')).toBeTruthy()
  })

  it('aggregiert gleiche Zutat NICHT über Listen-Grenzen hinweg', () => {
    // Bolognese am Mittwoch → Hackfleisch in Einkauf 1 (Mi=3 < Do=4)
    // Ein zweites Gericht mit Hackfleisch am Freitag → Hackfleisch in Einkauf 2 (Fr=5 >= Do=4)
    const zweitesGericht: Gericht = {
      id: 'g3', name: 'Chili con Carne', gesund: false, kategorie: 'suppe',
      beliebtheit: {}, quelle: 'manuell',
      zutaten: [{ name: 'Hackfleisch', menge: 400, einheit: 'g', haltbarkeit_tage: 2 }]
    }
    const eintraege: WochenplanEintrag[] = [
      { tag: 'mittwoch', mahlzeit: 'abend', gericht_id: 'g1', gericht_name: 'Spaghetti Bolognese' },
      { tag: 'freitag', mahlzeit: 'abend', gericht_id: 'g3', gericht_name: 'Chili con Carne' }
    ]
    const { einkauf1, einkauf2 } = generiereEinkaufslisten(eintraege, [bolognese, zweitesGericht], einkaufstag2)
    // Hackfleisch erscheint SEPARAT in beiden Listen — nicht zusammengeführt
    expect(einkauf1.find(i => i.name === 'Hackfleisch')?.menge).toBe(500) // Bolognese
    expect(einkauf2.find(i => i.name === 'Hackfleisch')?.menge).toBe(400) // Chili
  })
})
