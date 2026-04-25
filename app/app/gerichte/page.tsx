'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { Gericht, Zutat, ExtrasKatalogEintrag } from '@/types'

const EINHEITEN = ['g', 'kg', 'ml', 'l', 'Stück', 'EL', 'TL', 'Bund', 'Packung'] as const
const EINHEIT_KURZ: Record<string, string> = {
  g: 'g', kg: 'kg', ml: 'ml', l: 'l',
  Stück: 'Stk', EL: 'EL', TL: 'TL', Bund: 'Bd', Packung: 'Pckg',
}

const SPEZIAL_KAT = ['trainingstage', 'filmabend', 'frühstück', 'instagram'] as const

type GruppeId = 'gerichte' | 'trainingstage' | 'filmabend' | 'fruehstueck' | 'gesundheitssnack' | 'saft' | 'instagram'

export default function GerichtePage() {
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null)
  const [bearbeiteZutaten, setBearbeiteZutaten] = useState<Zutat[]>([])
  const [bearbeiteRezept, setBearbeiteRezept] = useState<{
    zutaten: string[]
    zubereitung: string[]
  } | null>(null)
  const [speichere, setSpeichere] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [loescht, setLoescht] = useState<string | null>(null)
  const [vorschlaege, setVorschlaege] = useState<Array<{
    name: string
    kategorie: string
    aufwand: string
    beschreibung: string
    rezept: { zutaten: string[]; zubereitung: string[] }
  }>>([])
  const [vorschlagHinweis, setVorschlagHinweis] = useState('')
  const [ladeVorschlaege, setLadeVorschlaege] = useState(false)
  const [fuegeHinzu, setFuegeHinzu] = useState<string | null>(null)
  const [extrasKatalog, setExtrasKatalog] = useState<ExtrasKatalogEintrag[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GruppeId | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [neuesGerichtOffen, setNeuesGerichtOffen] = useState(false)
  const [neuesGerichtName, setNeuesGerichtName] = useState('')
  const [neuesGerichtModus, setNeuesGerichtModus] = useState<'generieren' | 'manuell' | null>(null)
  const [neuesGerichtKategorie, setNeuesGerichtKategorie] = useState('sonstiges')
  const [neuesGerichtAufwand, setNeuesGerichtAufwand] = useState('30 Min')
  const [neuesGerichtZutatenOffen, setNeuesGerichtZutatenOffen] = useState(false)
  const [neuesGerichtZutaten, setNeuesGerichtZutaten] = useState<Zutat[]>([])
  const [neuesGerichtLaedt, setNeuesGerichtLaedt] = useState(false)

  useEffect(() => {
    apiFetch('/api/gerichte')
      .then(r => r.json())
      .then(setGerichte)
      .catch(() => setMeldung('❌ Gerichte konnten nicht geladen werden'))
    apiFetch('/api/extras/katalog')
      .then(r => r.json())
      .then(setExtrasKatalog)
      .catch(() => {})
  }, [])

  async function einzelnGenerieren(gericht: Gericht) {
    setMeldung(null)
    try {
      const res = await apiFetch('/api/zutaten/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: gericht.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setMeldung(`✅ ${gericht.name} aktualisiert`)
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    }
  }

  async function einzelnRezeptGenerieren(gericht: Gericht) {
    setMeldung(null)
    try {
      const res = await apiFetch('/api/rezepte/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: gericht.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setMeldung(`✅ Rezept für ${gericht.name} generiert`)
      const updated: typeof gerichte = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      if (bearbeiteId === gericht.id) {
        const neuesGericht = updated.find((g: { id: string }) => g.id === gericht.id)
        if (neuesGericht?.rezept) {
          setBearbeiteRezept({ zutaten: [...neuesGericht.rezept.zutaten], zubereitung: [...neuesGericht.rezept.zubereitung] })
        }
      }
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    }
  }

  function bearbeiteStart(gericht: Gericht) {
    setBearbeiteId(gericht.id)
    setBearbeiteZutaten([...gericht.zutaten])
    setBearbeiteRezept(gericht.rezept
      ? { zutaten: [...gericht.rezept.zutaten], zubereitung: [...gericht.rezept.zubereitung] }
      : null
    )
  }

  function zutatAendern(index: number, feld: keyof Zutat, wert: string | number) {
    setBearbeiteZutaten(prev => prev.map((z, i) =>
      i === index ? { ...z, [feld]: wert } : z
    ))
  }

  function zutatHinzufuegen() {
    setBearbeiteZutaten(prev => [
      ...prev,
      { name: '', menge: 0, einheit: 'g', haltbarkeit_tage: 1 }
    ])
  }

  function zutatEntfernen(index: number) {
    setBearbeiteZutaten(prev => prev.filter((_, i) => i !== index))
  }

  async function speichern(gerichtId: string) {
    setSpeichere(true)
    try {
      const res = await apiFetch('/api/gerichte/' + gerichtId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zutaten: bearbeiteZutaten, rezept: bearbeiteRezept })
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setBearbeiteId(null)
      setMeldung('✅ Gespeichert')
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setSpeichere(false)
    }
  }

  async function reaktivieren(id: string) {
    try {
      await apiFetch(`/api/gerichte/${id}/reaktivieren`, { method: 'PATCH' })
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setMeldung('✅ Gericht reaktiviert')
    } catch {
      setMeldung('❌ Reaktivieren fehlgeschlagen')
    }
  }

  async function vorschlaegeGenerieren() {
    setLadeVorschlaege(true)
    setMeldung(null)
    try {
      const res = await apiFetch('/api/gerichte/vorschlaege', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hinweis: vorschlagHinweis }),
      })
      if (!res.ok) throw new Error('Fehler beim Generieren')
      setVorschlaege(await res.json())
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setLadeVorschlaege(false)
    }
  }

  async function vorschlagHinzufuegen(vorschlag: typeof vorschlaege[0]) {
    setFuegeHinzu(vorschlag.name)
    try {
      const res = await apiFetch('/api/gerichte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vorschlag.name,
          kategorie: vorschlag.kategorie,
          aufwand: vorschlag.aufwand,
          gesund: false,
          quelle: 'ki-vorschlag',
        }),
      })
      if (!res.ok) throw new Error('Anlegen fehlgeschlagen')
      const neuesGericht = await res.json()
      await apiFetch('/api/zutaten/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: neuesGericht.id }),
      })
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setVorschlaege(prev => prev.filter(v => v.name !== vorschlag.name))
      setMeldung(`✅ ${vorschlag.name} hinzugefügt`)
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setFuegeHinzu(null)
    }
  }

  async function bewerten(id: string, sterne: number) {
    await apiFetch(`/api/gerichte/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bewertung: sterne }),
    })
    setGerichte(prev => prev.map(g => g.id === id ? { ...g, bewertung: sterne } : g))
  }

  async function loeschen(id: string) {
    setLoescht(id)
    try {
      await apiFetch(`/api/gerichte/${id}`, { method: 'DELETE' })
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setMeldung('✅ Gericht gelöscht')
    } catch {
      setMeldung('❌ Löschen fehlgeschlagen')
    } finally {
      setLoescht(null)
    }
  }

  function neuesGerichtZuruecksetzen() {
    setNeuesGerichtOffen(false)
    setNeuesGerichtName('')
    setNeuesGerichtModus(null)
    setNeuesGerichtAufwand('30 Min')
    setNeuesGerichtZutatenOffen(false)
    setNeuesGerichtZutaten([])
    setNeuesGerichtLaedt(false)
  }

  async function neuesGerichtSpeichern() {
    setNeuesGerichtLaedt(true)
    try {
      const res = await apiFetch('/api/gerichte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: neuesGerichtName.trim(),
          kategorie: neuesGerichtKategorie,
          aufwand: neuesGerichtAufwand,
          gesund: false,
          quelle: 'manuell',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Anlegen fehlgeschlagen')
      const zutatenGefiltert = neuesGerichtZutaten.filter(z => z.name.trim())
      if (zutatenGefiltert.length > 0) {
        await apiFetch(`/api/gerichte/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zutaten: zutatenGefiltert }),
        })
      }
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setMeldung(`✅ ${neuesGerichtName.trim()} hinzugefügt`)
      neuesGerichtZuruecksetzen()
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setNeuesGerichtLaedt(false)
    }
  }

  async function neuesGerichtGenerieren() {
    setNeuesGerichtLaedt(true)
    try {
      const res = await apiFetch('/api/gerichte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: neuesGerichtName.trim(),
          kategorie: 'sonstiges',
          aufwand: '30 Min',
          gesund: false,
          quelle: 'manuell',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Anlegen fehlgeschlagen')
      const zutatenRes = await apiFetch('/api/zutaten/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: data.id }),
      })
      if (!zutatenRes.ok) {
        const zutatenErr = await zutatenRes.json().catch(() => ({}))
        throw new Error((zutatenErr as { error?: string })?.error ?? 'Zutaten-Generierung fehlgeschlagen')
      }
      const rezeptRes = await apiFetch('/api/rezepte/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: data.id }),
      })
      if (!rezeptRes.ok) {
        const rezeptErr = await rezeptRes.json().catch(() => ({}))
        throw new Error((rezeptErr as { error?: string })?.error ?? 'Rezept-Generierung fehlgeschlagen')
      }
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setMeldung(`✅ ${neuesGerichtName.trim()} hinzugefügt`)
      neuesGerichtZuruecksetzen()
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setNeuesGerichtLaedt(false)
    }
  }

  // Computed
  const aktiveGerichte = gerichte.filter(g => !g.gesperrt)
  const gesperrteGerichte = gerichte.filter(g => g.gesperrt)
  const ohneZutaten = aktiveGerichte.filter(g => g.zutaten.length === 0).length

  const gefilterteGerichte = (() => {
    if (selectedGroup === 'gerichte') return aktiveGerichte.filter(g => !(SPEZIAL_KAT as readonly string[]).includes(g.kategorie))
    if (selectedGroup === 'trainingstage') return aktiveGerichte.filter(g => g.kategorie === 'trainingstage')
    if (selectedGroup === 'filmabend') return aktiveGerichte.filter(g => g.kategorie === 'filmabend')
    if (selectedGroup === 'fruehstueck') return aktiveGerichte.filter(g => g.kategorie === 'frühstück')
    if (selectedGroup === 'instagram') return aktiveGerichte.filter(g => g.kategorie === 'instagram')
    return []
  })()

  const defaultKategorieForGroup = selectedGroup === 'trainingstage' ? 'trainingstage'
    : selectedGroup === 'filmabend' ? 'filmabend'
    : selectedGroup === 'fruehstueck' ? 'frühstück'
    : selectedGroup === 'instagram' ? 'instagram'
    : 'sonstiges'

  const kategorienForGroup = selectedGroup === 'trainingstage' ? ['trainingstage']
    : selectedGroup === 'filmabend' ? ['filmabend']
    : selectedGroup === 'fruehstueck' ? ['frühstück']
    : selectedGroup === 'instagram' ? ['instagram']
    : ['fleisch', 'nudeln', 'suppe', 'auflauf', 'fisch', 'salat', 'sonstiges', 'kinder']

  const gruppen = [
    {
      id: 'gerichte' as GruppeId,
      label: 'Gerichte',
      icon: '🍽️',
      farbe: '#fffbf0',
      anzahl: aktiveGerichte.filter(g => !(SPEZIAL_KAT as readonly string[]).includes(g.kategorie)).length,
      einheit: 'Gerichte',
    },
    {
      id: 'trainingstage' as GruppeId,
      label: 'Trainingsgerichte',
      icon: '💪',
      farbe: '#fff7ed',
      anzahl: aktiveGerichte.filter(g => g.kategorie === 'trainingstage').length,
      einheit: 'Gerichte',
    },
    {
      id: 'filmabend' as GruppeId,
      label: 'Filmabend',
      icon: '🎬',
      farbe: '#f5f3ff',
      anzahl: aktiveGerichte.filter(g => g.kategorie === 'filmabend').length,
      einheit: 'Gerichte',
    },
    {
      id: 'fruehstueck' as GruppeId,
      label: 'Frühstück',
      icon: '🥐',
      farbe: '#fefce8',
      anzahl: aktiveGerichte.filter(g => g.kategorie === 'frühstück').length,
      einheit: 'Gerichte',
    },
    {
      id: 'gesundheitssnack' as GruppeId,
      label: 'Gesundheitssnacks',
      icon: '🍏',
      farbe: '#f0fdf4',
      anzahl: extrasKatalog.filter(e => e.typ === 'snack').length,
      einheit: 'Snacks',
    },
    {
      id: 'saft' as GruppeId,
      label: 'Säfte',
      icon: '🥤',
      farbe: '#f0fdf4',
      anzahl: extrasKatalog.filter(e => e.typ === 'saft').length,
      einheit: 'Säfte',
    },
    {
      id: 'instagram' as GruppeId,
      label: 'Instagram',
      icon: '📷',
      farbe: '#fdf2f8',
      anzahl: aktiveGerichte.filter(g => g.kategorie === 'instagram').length,
      einheit: 'Gerichte',
    },
  ]

  const aktiveGruppe = gruppen.find(g => g.id === selectedGroup)
  const isExtrasGruppe = selectedGroup === 'gesundheitssnack' || selectedGroup === 'saft'

  function zureuckZurUebersicht() {
    setSelectedGroup(null)
    neuesGerichtZuruecksetzen()
    setExpandedId(null)
    setBearbeiteId(null)
    setMeldung(null)
  }

  function gruppeOeffnen(id: GruppeId) {
    setSelectedGroup(id)
    setNeuesGerichtKategorie(
      id === 'trainingstage' ? 'trainingstage'
      : id === 'filmabend' ? 'filmabend'
      : id === 'fruehstueck' ? 'frühstück'
      : id === 'instagram' ? 'instagram'
      : 'sonstiges'
    )
  }

  // Gericht-Karte (wiederverwendet in Listenrendering)
  function renderGerichtCard(gericht: Gericht) {
    const isExpanded = expandedId === gericht.id
    const isEditing = bearbeiteId === gericht.id
    return (
      <div
        key={gericht.id}
        className="relative rounded-2xl p-4"
        style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}
      >
        <button
          onClick={e => {
            e.stopPropagation()
            if (window.confirm('Gericht wirklich löschen?')) loeschen(gericht.id)
          }}
          disabled={loescht === gericht.id}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full disabled:opacity-50 active:opacity-70"
          style={{ background: 'var(--rausch)', color: '#ffffff' }}
          aria-label="Gericht löschen"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>

        <div
          role="button" tabIndex={0} className="w-full text-left cursor-pointer"
          onClick={() => !isEditing && setExpandedId(isExpanded ? null : gericht.id)}
          onKeyDown={e => e.key === 'Enter' && !isEditing && setExpandedId(isExpanded ? null : gericht.id)}
        >
          <div className="flex items-start gap-2 flex-wrap">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{gericht.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--gray-secondary)' }}>
              {gericht.kategorie}
            </span>
          </div>
          <div className="flex gap-0.5 mt-1.5" onClick={e => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => bewerten(gericht.id, s)} className="text-base leading-none"
                style={{ color: s <= (gericht.bewertung ?? 3) ? '#f59e0b' : '#e5e5e5' }}>★</button>
            ))}
          </div>
          {!isEditing && (
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--gray-secondary)' }}>
              {gericht.zutaten.length === 0
                ? 'Keine Zutaten hinterlegt'
                : gericht.zutaten.some(z => z.name === 'Essen wird bestellt')
                  ? 'Essen wird bestellt'
                  : gericht.zutaten.map(z => `${z.menge}${z.einheit} ${z.name}`).join(', ')}
            </p>
          )}
        </div>

        {isExpanded && !isEditing && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--surface)' }}>
            {gericht.rezept && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--near-black)' }}>Zubereitung</p>
                <ol className="space-y-1">
                  {gericht.rezept.zubereitung.map((schritt, i) => (
                    <li key={`schritt-${gericht.id}-${i}`} className="text-xs flex gap-2" style={{ color: 'var(--gray-secondary)' }}>
                      <span className="shrink-0 font-semibold" style={{ color: 'var(--rausch)' }}>{i + 1}.</span>
                      {schritt.replace(/^Schritt \d+:\s*/i, '')}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => einzelnGenerieren(gericht)}
                className="flex-1 text-xs font-medium py-2 rounded-xl active:opacity-70"
                style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>
                Neu generieren
              </button>
              <button onClick={() => { bearbeiteStart(gericht); setExpandedId(null) }}
                className="flex-1 text-xs font-semibold py-2 rounded-xl active:opacity-70"
                style={{ background: 'var(--near-black)', color: '#ffffff' }}>
                Bearbeiten
              </button>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="mt-3 space-y-2" style={{ borderTop: '1px solid var(--surface)', paddingTop: '12px' }}>
            {bearbeiteZutaten.map((zutat, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input value={zutat.name} onChange={e => zutatAendern(i, 'name', e.target.value)} placeholder="Name"
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg"
                  style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '13px' }} />
                <input type="number" value={zutat.menge} onChange={e => zutatAendern(i, 'menge', parseFloat(e.target.value))}
                  className="px-2 py-1.5 rounded-lg"
                  style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '13px', width: '50px' }} />
                <select value={zutat.einheit} onChange={e => zutatAendern(i, 'einheit', e.target.value)}
                  className="px-1 py-1.5 rounded-lg"
                  style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '13px', width: '52px' }}>
                  {EINHEITEN.map(e => <option key={e} value={e}>{EINHEIT_KURZ[e]}</option>)}
                </select>
                <button onClick={() => zutatEntfernen(i)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70"
                  style={{ background: '#fff0f3', color: 'var(--rausch)' }}>✕</button>
              </div>
            ))}
            {bearbeiteRezept && (
              <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--surface)', paddingTop: '12px' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--near-black)' }}>Zubereitung</p>
                {bearbeiteRezept.zubereitung.map((schritt, i) => (
                  <div key={`edit-schritt-${i}`} className="flex gap-1.5 items-start">
                    <span className="text-xs font-semibold pt-2 shrink-0" style={{ color: 'var(--rausch)' }}>{i + 1}.</span>
                    <textarea value={schritt.replace(/^Schritt \d+:\s*/i, '')}
                      onChange={e => {
                        const neu = [...bearbeiteRezept.zubereitung]
                        neu[i] = e.target.value
                        setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: neu })
                      }}
                      rows={2} className="flex-1 px-2 py-1.5 rounded-lg resize-none"
                      style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '14px' }} />
                    <button onClick={() => {
                      const neu = bearbeiteRezept.zubereitung.filter((_, idx) => idx !== i)
                      setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: neu })
                    }} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70"
                      style={{ background: '#fff0f3', color: 'var(--rausch)' }}>✕</button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: [...bearbeiteRezept.zubereitung, ''] })}
                    className="text-xs font-medium px-3 py-2 rounded-xl"
                    style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}>+ Schritt</button>
                  <button onClick={() => einzelnRezeptGenerieren(gericht)}
                    className="text-xs font-medium px-3 py-2 rounded-xl"
                    style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>✨ Rezept neu generieren</button>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={zutatHinzufuegen} className="text-xs font-medium px-3 py-2 rounded-xl"
                style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}>+ Zutat</button>
              <button onClick={() => speichern(gericht.id)} disabled={speichere}
                className="text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
                style={{ background: 'var(--near-black)', color: '#ffffff' }}>
                {speichere ? '...' : 'Speichern'}
              </button>
              <button onClick={() => { setBearbeiteId(null); setBearbeiteRezept(null) }}
                className="text-xs font-medium px-3 py-2 rounded-xl"
                style={{ background: 'var(--surface)', color: 'var(--gray-secondary)' }}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white pb-28">

      {/* ===== ÜBERSICHT ===== */}
      {selectedGroup === null && (
        <>
          <div className="px-4 pt-12 pb-6">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
              Gerichte
            </h1>
            {ohneZutaten > 0 && (
              <p className="text-xs mt-1" style={{ color: '#c13515' }}>⚠️ {ohneZutaten} Gerichte ohne Zutaten</p>
            )}
          </div>
          {meldung && (
            <div className="mx-4 mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>
              {meldung}
            </div>
          )}
          <div className="px-4 grid grid-cols-2 gap-3 pb-6">
            {gruppen.map(gruppe => (
              <button
                key={gruppe.id}
                onClick={() => gruppeOeffnen(gruppe.id)}
                className="rounded-2xl p-5 flex flex-col items-start text-left active:opacity-70 transition-opacity"
                style={{ background: gruppe.farbe, boxShadow: 'var(--card-shadow)' }}
              >
                <span className="text-3xl mb-3">{gruppe.icon}</span>
                <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--near-black)' }}>
                  {gruppe.label}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--gray-secondary)' }}>
                  {gruppe.anzahl} {gruppe.einheit}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ===== DETAIL: NORMALE GERICHTE-GRUPPEN ===== */}
      {selectedGroup !== null && !isExtrasGruppe && (
        <>
          {/* Header mit Zurück */}
          <div className="px-4 pt-12 pb-4">
            <button
              onClick={zureuckZurUebersicht}
              className="flex items-center gap-1.5 text-sm font-medium mb-4 active:opacity-70"
              style={{ color: 'var(--gray-secondary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Übersicht
            </button>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
              {aktiveGruppe?.label}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--gray-secondary)' }}>
              {gefilterteGerichte.length} {selectedGroup === 'fruehstueck' ? `+ 1 festes Frühstück` : 'Gerichte'}
            </p>
          </div>

          {meldung && (
            <div className="mx-4 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>
              {meldung}
            </div>
          )}

          {/* "Neue Gerichte entdecken" — nur bei Gerichte */}
          {selectedGroup === 'gerichte' && (
            <div className="mx-4 mb-5 rounded-2xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--near-black)' }}>Neue Gerichte entdecken</h2>
              <div className="flex gap-2 mb-3">
                <input type="text" value={vorschlagHinweis} onChange={e => setVorschlagHinweis(e.target.value)}
                  placeholder="z.B. mehr Fisch"
                  className="flex-1 rounded-xl outline-none"
                  style={{ background: '#ffffff', border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', padding: '12px 14px', minHeight: '48px' }} />
                <button onClick={vorschlaegeGenerieren} disabled={ladeVorschlaege}
                  className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50"
                  style={{ background: 'var(--rausch)', color: '#ffffff' }}>
                  {ladeVorschlaege ? '...' : '3 Ideen'}
                </button>
              </div>
              {vorschlaege.length > 0 && (
                <div className="space-y-3">
                  {vorschlaege.map(v => (
                    <div key={v.name} className="rounded-xl p-3" style={{ background: '#ffffff', border: '1px solid var(--border)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{v.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--gray-secondary)' }}>{v.kategorie} · {v.aufwand}</p>
                          {v.beschreibung && <p className="text-xs mt-1" style={{ color: 'var(--gray-secondary)' }}>{v.beschreibung}</p>}
                          {v.rezept && (
                            <div className="mt-2 space-y-1.5">
                              <div>
                                <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--near-black)' }}>Zutaten (4 Personen)</p>
                                <ul className="space-y-0.5">
                                  {v.rezept.zutaten.map((z, i) => (
                                    <li key={`${v.name}-zutat-${i}`} className="text-xs" style={{ color: 'var(--gray-secondary)' }}>· {z}</li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--near-black)' }}>Zubereitung</p>
                                <ol className="space-y-1">
                                  {v.rezept.zubereitung.map((s, i) => (
                                    <li key={`${v.name}-schritt-${i}`} className="text-xs" style={{ color: 'var(--gray-secondary)' }}>
                                      {i + 1}. {s.replace(/^Schritt \d+:\s*/i, '')}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <button onClick={() => vorschlagHinzufuegen(v)} disabled={fuegeHinzu === v.name}
                            className="text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50"
                            style={{ background: 'var(--near-black)', color: '#ffffff' }}>
                            {fuegeHinzu === v.name ? '...' : '+ Hinzufügen'}
                          </button>
                          <button onClick={() => setVorschlaege(prev => prev.filter(x => x.name !== v.name))}
                            className="text-xs font-medium px-3 py-1.5 rounded-xl"
                            style={{ background: 'var(--surface)', color: 'var(--gray-secondary)' }}>
                            Überspringen
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Neues Gericht hinzufügen — bei Insta deaktiviert (Gerichte kommen nur via Import) */}
          {!neuesGerichtOffen && selectedGroup !== 'instagram' && (
            <div className="mx-4 mb-4">
              <button
                onClick={() => { setNeuesGerichtOffen(true); setNeuesGerichtKategorie(defaultKategorieForGroup) }}
                className="w-full flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold active:opacity-70 transition-opacity"
                style={{ background: 'var(--surface)', color: 'var(--near-black)', minHeight: '52px', boxShadow: 'var(--card-shadow)' }}
              >
                ＋ Neues Gericht hinzufügen
              </button>
            </div>
          )}
          {selectedGroup === 'instagram' && !neuesGerichtOffen && (
            <div className="mx-4 mb-4 text-xs text-center" style={{ color: 'var(--gray-secondary)' }}>
              Insta-Gerichte werden über den iOS-Shortcut „An Jarvis senden" importiert.
            </div>
          )}

          {neuesGerichtOffen && (
            <div className="mx-4 mb-4 rounded-2xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--near-black)' }}>Neues Gericht</h2>
              <input type="text" value={neuesGerichtName} onChange={e => setNeuesGerichtName(e.target.value)}
                placeholder="Name des Gerichts" className="w-full rounded-xl outline-none mb-3"
                style={{ background: '#ffffff', border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', padding: '12px 14px', minHeight: '48px' }} />
              <div className="flex gap-2 mb-3">
                <button onClick={() => setNeuesGerichtModus('generieren')}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl active:opacity-70"
                  style={{ background: 'var(--near-black)', color: '#ffffff', opacity: neuesGerichtModus && neuesGerichtModus !== 'generieren' ? 0.35 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
                  </svg>
                  Generieren
                </button>
                <button onClick={() => setNeuesGerichtModus('manuell')}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl active:opacity-70"
                  style={{ background: 'var(--near-black)', color: '#ffffff', opacity: neuesGerichtModus && neuesGerichtModus !== 'manuell' ? 0.35 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Manuell
                </button>
              </div>

              {neuesGerichtModus === 'manuell' && (
                <>
                  <div className="flex gap-2 mb-3">
                    <select value={neuesGerichtKategorie} onChange={e => setNeuesGerichtKategorie(e.target.value)}
                      className="flex-1 rounded-xl px-3"
                      style={{ border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', minHeight: '48px', background: '#ffffff' }}>
                      {kategorienForGroup.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <select value={neuesGerichtAufwand} onChange={e => setNeuesGerichtAufwand(e.target.value)}
                      className="rounded-xl px-3"
                      style={{ border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', minHeight: '48px', background: '#ffffff' }}>
                      {['15 Min', '30 Min', '45 Min', '60+ Min'].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      const oeffnen = !neuesGerichtZutatenOffen
                      setNeuesGerichtZutatenOffen(oeffnen)
                      if (oeffnen && neuesGerichtZutaten.length === 0) {
                        setNeuesGerichtZutaten([{ name: '', menge: 0, einheit: 'g', haltbarkeit_tage: 1 }])
                      }
                    }}
                    className="w-full text-xs font-medium py-2 rounded-xl mb-3"
                    style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}>
                    {neuesGerichtZutatenOffen ? '▲ Zutaten ausblenden' : '＋ Zutaten & Rezept jetzt hinzufügen'}
                  </button>
                  {neuesGerichtZutatenOffen && (
                    <div className="space-y-2 mb-3">
                      {neuesGerichtZutaten.map((zutat, i) => (
                        <div key={i} className="flex gap-1.5 items-center">
                          <input value={zutat.name}
                            onChange={e => setNeuesGerichtZutaten(prev => prev.map((z, idx) => idx === i ? { ...z, name: e.target.value } : z))}
                            placeholder="Name" className="flex-1 min-w-0 px-2 py-1.5 rounded-lg"
                            style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '13px' }} />
                          <input type="number" value={zutat.menge}
                            onChange={e => setNeuesGerichtZutaten(prev => prev.map((z, idx) => idx === i ? { ...z, menge: parseFloat(e.target.value) || 0 } : z))}
                            className="px-2 py-1.5 rounded-lg"
                            style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '13px', width: '50px' }} />
                          <select value={zutat.einheit}
                            onChange={e => setNeuesGerichtZutaten(prev => prev.map((z, idx) => idx === i ? { ...z, einheit: e.target.value } : z))}
                            className="px-1 py-1.5 rounded-lg"
                            style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '13px', width: '52px' }}>
                            {EINHEITEN.map(e => <option key={e} value={e}>{EINHEIT_KURZ[e]}</option>)}
                          </select>
                          <button onClick={() => setNeuesGerichtZutaten(prev => prev.filter((_, idx) => idx !== i))}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70"
                            style={{ background: '#fff0f3', color: 'var(--rausch)' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => setNeuesGerichtZutaten(prev => [...prev, { name: '', menge: 0, einheit: 'g', haltbarkeit_tage: 1 }])}
                        className="text-xs font-medium px-3 py-2 rounded-xl"
                        style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}>+ Zutat</button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={neuesGerichtSpeichern} disabled={!neuesGerichtName.trim() || neuesGerichtLaedt}
                      className="flex-1 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 active:opacity-70"
                      style={{ background: 'var(--near-black)', color: '#ffffff' }}>
                      {neuesGerichtLaedt ? '...' : 'Speichern'}
                    </button>
                    <button onClick={neuesGerichtZuruecksetzen}
                      className="text-sm font-medium px-4 py-2.5 rounded-xl"
                      style={{ background: '#f0f0f0', color: 'var(--near-black)' }}>Abbrechen</button>
                  </div>
                </>
              )}

              {neuesGerichtModus === 'generieren' && (
                <button onClick={neuesGerichtGenerieren} disabled={!neuesGerichtName.trim() || neuesGerichtLaedt}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 active:opacity-70"
                  style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '48px' }}>
                  {neuesGerichtLaedt ? '...' : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                        <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
                      </svg>
                      Zutaten & Rezept generieren
                    </>
                  )}
                </button>
              )}

              {neuesGerichtModus !== 'manuell' && (
                <button onClick={neuesGerichtZuruecksetzen}
                  className="w-full text-sm font-medium py-2.5 rounded-xl mt-2"
                  style={{ background: '#f0f0f0', color: 'var(--near-black)' }}>Abbrechen</button>
              )}
            </div>
          )}

          {/* Festes Frühstück Mo–Fr */}
          {selectedGroup === 'fruehstueck' && (
            <div className="mx-4 mb-3 rounded-2xl p-4 flex items-center justify-between"
              style={{ background: '#fefce8', boxShadow: 'var(--card-shadow)' }}>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--gray-secondary)' }}>Montag – Freitag (fest)</p>
                <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>Toast mit Aufschnitt</p>
              </div>
              <span className="text-2xl">🍞</span>
            </div>
          )}

          {/* Gerichtsliste */}
          <div className="px-4 space-y-3 pb-4">
            {gefilterteGerichte.map(gericht => renderGerichtCard(gericht))}
          </div>

          {/* Gesperrte — nur bei Gerichte */}
          {selectedGroup === 'gerichte' && gesperrteGerichte.length > 0 && (
            <div className="px-4 mt-4 mb-4">
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--near-black)' }}>
                Gesperrt ({gesperrteGerichte.length})
              </h2>
              <p className="text-xs mb-3" style={{ color: 'var(--gray-secondary)' }}>
                Zu oft getauscht — werden nicht mehr vorgeschlagen.
              </p>
              <div className="space-y-2">
                {gesperrteGerichte.map(gericht => (
                  <div key={gericht.id} className="rounded-2xl p-4 flex justify-between items-center"
                    style={{ background: '#fff5f5', boxShadow: 'var(--card-shadow)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{gericht.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--rausch)' }}>{gericht.tausch_count}× getauscht</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => reaktivieren(gericht.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                        style={{ background: 'var(--near-black)', color: '#ffffff' }}>Reaktivieren</button>
                      <button onClick={() => loeschen(gericht.id)} disabled={loescht === gericht.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-xl disabled:opacity-50"
                        style={{ background: 'var(--surface)', color: 'var(--rausch)' }}>
                        {loescht === gericht.id ? '...' : 'Löschen'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== DETAIL: EXTRAS (GESUNDHEITSSNACKS / SÄFTE) ===== */}
      {selectedGroup !== null && isExtrasGruppe && (
        <>
          <div className="px-4 pt-12 pb-4">
            <button onClick={zureuckZurUebersicht}
              className="flex items-center gap-1.5 text-sm font-medium mb-4 active:opacity-70"
              style={{ color: 'var(--gray-secondary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Übersicht
            </button>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
              {aktiveGruppe?.label}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--gray-secondary)' }}>
              {extrasKatalog.filter(e => e.typ === (selectedGroup === 'gesundheitssnack' ? 'snack' : 'saft')).length} Einträge
            </p>
          </div>
          {meldung && (
            <div className="mx-4 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>
              {meldung}
            </div>
          )}
          <div className="px-4 space-y-3 pb-6">
            {extrasKatalog
              .filter(e => e.typ === (selectedGroup === 'gesundheitssnack' ? 'snack' : 'saft'))
              .map(extra => (
                <div key={extra.id} className="rounded-2xl p-4" style={{ background: '#f0fdf4', boxShadow: 'var(--card-shadow)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{extra.name}</span>
                    <span className="text-base">{extra.typ === 'snack' ? '🍏' : '🥤'}</span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'var(--gray-secondary)' }}>
                    {extra.zutaten.map(z => `${z.menge > 0 ? z.menge + z.einheit + ' ' : ''}${z.name}`).join(', ')}
                  </p>
                  {extra.zubereitung && (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--gray-secondary)' }}>{extra.zubereitung}</p>
                  )}
                  {extra.geschmacks_hinweis && (
                    <p className="text-xs mt-1.5 italic" style={{ color: '#16a34a' }}>💡 {extra.geschmacks_hinweis}</p>
                  )}
                </div>
              ))}
          </div>
        </>
      )}

    </main>
  )
}
