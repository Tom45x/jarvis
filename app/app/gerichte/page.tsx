'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { Gericht, Zutat } from '@/types'

export default function GerichtePage() {
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null)
  const [bearbeiteZutaten, setBearbeiteZutaten] = useState<Zutat[]>([])
  const [bearbeiteRezept, setBearbeiteRezept] = useState<{
    zutaten: string[]
    zubereitung: string[]
  } | null>(null)
  const [generiere, setGeneriere] = useState(false)
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
  const [rezeptOffen, setRezeptOffen] = useState<string | null>(null)
  const [filterKategorie, setFilterKategorie] = useState<string>('alle')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/gerichte')
      .then(r => r.json())
      .then(setGerichte)
      .catch(() => setMeldung('❌ Gerichte konnten nicht geladen werden'))
  }, [])

  async function allesDatenGenerieren() {
    setGeneriere(true)
    setMeldung(null)
    try {
      const res = await apiFetch('/api/zutaten/generieren', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      // Rezepte generieren (nur für Gerichte ohne Rezept)
      const res2 = await apiFetch('/api/rezepte/generieren', { method: 'POST' })
      const data2 = await res2.json()
      if (!res2.ok) throw new Error(data2.error ?? 'Fehler')
      setMeldung(`✅ ${data.aktualisiert} Zutaten, ${data2.aktualisiert} Rezepte aktualisiert`)
      const updated = await apiFetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setGeneriere(false)
    }
  }

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
      // Im Edit-Modus: bearbeiteRezept mit neuem Rezept synchronisieren
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

  const aktiveGerichte = gerichte.filter(g => !g.gesperrt)
  const gesperrteGerichte = gerichte.filter(g => g.gesperrt)
  const ohneZutaten = aktiveGerichte.filter(g => g.zutaten.length === 0).length

  const alleKategorien = ['alle', ...Array.from(new Set(aktiveGerichte.map(g => g.kategorie))).sort()]
  const gefilterteGerichte = filterKategorie === 'alle'
    ? aktiveGerichte
    : aktiveGerichte.filter(g => g.kategorie === filterKategorie)

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <div className="flex justify-between items-start mb-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
            Gerichte
          </h1>
          <button
            onClick={allesDatenGenerieren}
            disabled={generiere}
            className="text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50"
            style={{ background: 'var(--surface)', color: 'var(--near-black)' }}
          >
            {generiere ? '...' : '✨ Generieren'}
          </button>
        </div>
        {ohneZutaten > 0 && (
          <p className="text-xs mt-1" style={{ color: '#c13515' }}>
            ⚠️ {ohneZutaten} Gerichte ohne Zutaten
          </p>
        )}
      </div>

      {meldung && (
        <div className="mx-4 mb-3 px-4 py-3 rounded-2xl text-sm" style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>
          {meldung}
        </div>
      )}

      {/* Neue Gerichte entdecken */}
      <div className="mx-4 mb-5 rounded-2xl p-4" style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--near-black)' }}>
          Neue Gerichte entdecken
        </h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={vorschlagHinweis}
            onChange={e => setVorschlagHinweis(e.target.value)}
            placeholder="z.B. mehr Fisch, Wochenend-Frühstück …"
            className="flex-1 rounded-xl outline-none"
            style={{ background: '#ffffff', border: '1.5px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', padding: '12px 14px', minHeight: '48px' }}
          />
          <button
            onClick={vorschlaegeGenerieren}
            disabled={ladeVorschlaege}
            className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-50"
            style={{ background: 'var(--rausch)', color: '#ffffff' }}
          >
            {ladeVorschlaege ? '...' : '3 Ideen'}
          </button>
        </div>

        {vorschlaege.length > 0 && (
          <div className="space-y-3">
            {vorschlaege.map(v => (
              <div key={v.name} className="bg-white rounded-xl p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{v.name}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--gray-secondary)' }}>{v.beschreibung}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: '#f0f0f0', color: 'var(--near-black)' }}>
                        {v.kategorie}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: '#f0f0f0', color: 'var(--near-black)' }}>
                        ⏱ {v.aufwand}
                      </span>
                      <button
                        onClick={() => setRezeptOffen(rezeptOffen === v.name ? null : v.name)}
                        className="text-xs font-medium"
                        style={{ color: 'var(--rausch)' }}
                      >
                        {rezeptOffen === v.name ? 'Rezept ▲' : 'Rezept ▼'}
                      </button>
                    </div>

                    {rezeptOffen === v.name && (
                      <div className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
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
                    <button
                      onClick={() => vorschlagHinzufuegen(v)}
                      disabled={fuegeHinzu === v.name}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50"
                      style={{ background: 'var(--near-black)', color: '#ffffff' }}
                    >
                      {fuegeHinzu === v.name ? '...' : '+ Hinzufügen'}
                    </button>
                    <button
                      onClick={() => setVorschlaege(prev => prev.filter(x => x.name !== v.name))}
                      className="text-xs font-medium px-3 py-1.5 rounded-xl"
                      style={{ background: 'var(--surface)', color: 'var(--gray-secondary)' }}
                    >
                      Überspringen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kategorie-Filter */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto scroll-hide pb-1">
          {alleKategorien.map(kat => (
            <button
              key={kat}
              onClick={() => setFilterKategorie(kat)}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: filterKategorie === kat ? 'var(--near-black)' : 'var(--surface)',
                color: filterKategorie === kat ? '#ffffff' : 'var(--near-black)',
              }}
            >
              {kat === 'alle' ? `Alle (${aktiveGerichte.length})` : kat}
            </button>
          ))}
        </div>
      </div>

      {/* Gerichtsliste */}
      <div className="px-4 space-y-3 pb-4">
        {gefilterteGerichte.map(gericht => {
          const isExpanded = expandedId === gericht.id
          const isEditing = bearbeiteId === gericht.id
          return (
            <div
              key={gericht.id}
              className="rounded-2xl p-4"
              style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}
            >
              {/* Kopfzeile: Name + Badges — div statt button wegen verschachtelten Sterne-Buttons */}
              <div
                role="button"
                tabIndex={0}
                className="w-full text-left cursor-pointer"
                onClick={() => !isEditing && setExpandedId(isExpanded ? null : gericht.id)}
                onKeyDown={e => e.key === 'Enter' && !isEditing && setExpandedId(isExpanded ? null : gericht.id)}
              >
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>
                    {gericht.name}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface)', color: 'var(--gray-secondary)' }}>
                    {gericht.kategorie}
                  </span>
                </div>

                {/* Sterne */}
                <div className="flex gap-0.5 mt-1.5" onClick={e => e.stopPropagation()}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onClick={() => bewerten(gericht.id, s)}
                      className="text-base leading-none"
                      style={{ color: s <= (gericht.bewertung ?? 3) ? '#f59e0b' : '#e5e5e5' }}
                    >
                      ★
                    </button>
                  ))}
                </div>

                {/* Zutaten-Vorschau */}
                {!isEditing && (
                  <p
                    className="text-xs mt-1.5 leading-relaxed"
                    style={{ color: 'var(--gray-secondary)' }}
                  >
                    {gericht.zutaten.length === 0
                      ? 'Keine Zutaten hinterlegt'
                      : gericht.zutaten.some(z => z.name === 'Essen wird bestellt')
                        ? 'Essen wird bestellt'
                        : gericht.zutaten.map(z => `${z.menge}${z.einheit} ${z.name}`).join(', ')}
                  </p>
                )}

                {/* Rezept-Vorschau */}
                {!isEditing && gericht.rezept && (
                  <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--surface)' }}>
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
              </div>

              {/* Action-Buttons (nur wenn nicht im Bearbeitungsmodus) */}
              {!isEditing && (
                <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--surface)' }}>
                  <button
                    onClick={() => einzelnGenerieren(gericht)}
                    className="flex-1 text-xs font-medium py-2 rounded-xl active:opacity-70"
                    style={{ background: 'var(--surface)', color: 'var(--near-black)' }}
                  >
                    Neu generieren
                  </button>
                  <button
                    onClick={() => { bearbeiteStart(gericht); setExpandedId(null) }}
                    className="flex-1 text-xs font-semibold py-2 rounded-xl active:opacity-70"
                    style={{ background: 'var(--near-black)', color: '#ffffff' }}
                  >
                    Bearbeiten
                  </button>
                </div>
              )}

              {/* Zutaten bearbeiten */}
              {isEditing && (
                <div className="mt-3 space-y-2" style={{ borderTop: '1px solid var(--surface)', paddingTop: '12px' }}>
                  {bearbeiteZutaten.map((zutat, i) => (
                    <div key={`${zutat.name}-${i}`} className="flex gap-1.5 items-center">
                      <input
                        value={zutat.name}
                        onChange={e => zutatAendern(i, 'name', e.target.value)}
                        placeholder="Name"
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '16px' }}
                      />
                      <input
                        type="number"
                        value={zutat.menge}
                        onChange={e => zutatAendern(i, 'menge', parseFloat(e.target.value))}
                        className="px-2 py-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '16px', width: '56px' }}
                      />
                      <select
                        value={zutat.einheit}
                        onChange={e => zutatAendern(i, 'einheit', e.target.value)}
                        className="px-1 py-1.5 rounded-lg"
                        style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '16px' }}
                      >
                        {['g', 'kg', 'ml', 'l', 'Stück', 'EL', 'TL', 'Bund', 'Packung'].map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => zutatEntfernen(i)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70"
                        style={{ background: '#fff0f3', color: 'var(--rausch)' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {/* Rezept bearbeiten */}
                  {bearbeiteRezept && (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--surface)', paddingTop: '12px' }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--near-black)' }}>Zubereitung</p>
                      {bearbeiteRezept.zubereitung.map((schritt, i) => (
                        <div key={`edit-schritt-${i}`} className="flex gap-1.5 items-start">
                          <span className="text-xs font-semibold pt-2 shrink-0" style={{ color: 'var(--rausch)' }}>{i + 1}.</span>
                          <textarea
                            value={schritt.replace(/^Schritt \d+:\s*/i, '')}
                            onChange={e => {
                              const neu = [...bearbeiteRezept.zubereitung]
                              neu[i] = e.target.value
                              setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: neu })
                            }}
                            rows={2}
                            className="flex-1 px-2 py-1.5 rounded-lg resize-none"
                            style={{ border: '1px solid var(--border)', color: 'var(--near-black)', fontSize: '14px' }}
                          />
                          <button
                            onClick={() => {
                              const neu = bearbeiteRezept.zubereitung.filter((_, idx) => idx !== i)
                              setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: neu })
                            }}
                            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70"
                            style={{ background: '#fff0f3', color: 'var(--rausch)' }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setBearbeiteRezept({ ...bearbeiteRezept, zubereitung: [...bearbeiteRezept.zubereitung, ''] })}
                          className="text-xs font-medium px-3 py-2 rounded-xl"
                          style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}
                        >
                          + Schritt
                        </button>
                        <button
                          onClick={() => einzelnRezeptGenerieren(gericht)}
                          className="text-xs font-medium px-3 py-2 rounded-xl"
                          style={{ background: 'var(--surface)', color: 'var(--near-black)' }}
                        >
                          ✨ Rezept neu generieren
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={zutatHinzufuegen}
                      className="text-xs font-medium px-3 py-2 rounded-xl"
                      style={{ border: '1.5px dashed var(--border)', color: 'var(--gray-secondary)' }}
                    >
                      + Zutat
                    </button>
                    <button
                      onClick={() => speichern(gericht.id)}
                      disabled={speichere}
                      className="text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
                      style={{ background: 'var(--near-black)', color: '#ffffff' }}
                    >
                      {speichere ? '...' : 'Speichern'}
                    </button>
                    <button
                      onClick={() => { setBearbeiteId(null); setBearbeiteRezept(null) }}
                      className="text-xs font-medium px-3 py-2 rounded-xl"
                      style={{ background: 'var(--surface)', color: 'var(--gray-secondary)' }}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Gesperrte Gerichte */}
      {gesperrteGerichte.length > 0 && (
        <div className="px-4 mt-4 mb-4">
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--near-black)' }}>
            Gesperrt ({gesperrteGerichte.length})
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--gray-secondary)' }}>
            Zu oft getauscht — werden nicht mehr vorgeschlagen.
          </p>
          <div className="space-y-2">
            {gesperrteGerichte.map(gericht => (
              <div
                key={gericht.id}
                className="rounded-2xl p-4 flex justify-between items-center"
                style={{ background: '#fff5f5', boxShadow: 'var(--card-shadow)' }}
              >
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{gericht.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--rausch)' }}>
                    {gericht.tausch_count}× getauscht
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reaktivieren(gericht.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                    style={{ background: 'var(--near-black)', color: '#ffffff' }}
                  >
                    Reaktivieren
                  </button>
                  <button
                    onClick={() => loeschen(gericht.id)}
                    disabled={loescht === gericht.id}
                    className="text-xs font-medium px-3 py-1.5 rounded-xl disabled:opacity-50"
                    style={{ background: 'var(--surface)', color: 'var(--rausch)' }}
                  >
                    {loescht === gericht.id ? '...' : 'Löschen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
