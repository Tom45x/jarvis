'use client'

import { useEffect, useState } from 'react'
import type { Gericht, Zutat } from '@/types'

export default function GerichtePage() {
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null)
  const [bearbeiteZutaten, setBearbeiteZutaten] = useState<Zutat[]>([])
  const [generiere, setGeneriere] = useState(false)
  const [speichere, setSpeichere] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [loescht, setLoescht] = useState<string | null>(null)
  const [vorschlaege, setVorschlaege] = useState<Array<{
    name: string
    kategorie: string
    aufwand: string
    beschreibung: string
    rezept_url: string | null
  }>>([])
  const [vorschlagHinweis, setVorschlagHinweis] = useState('')
  const [ladeVorschlaege, setLadeVorschlaege] = useState(false)
  const [fuegeHinzu, setFuegeHinzu] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gerichte').then(r => r.json()).then(setGerichte)
  }, [])

  async function alleZutatenGenerieren() {
    setGeneriere(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/zutaten/generieren', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setMeldung(`✅ ${data.aktualisiert} Gerichte aktualisiert`)
      const updated = await fetch('/api/gerichte').then(r => r.json())
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
      const res = await fetch('/api/zutaten/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: gericht.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      setMeldung(`✅ ${gericht.name} aktualisiert`)
      const updated = await fetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    }
  }

  function bearbeiteStart(gericht: Gericht) {
    setBearbeiteId(gericht.id)
    setBearbeiteZutaten([...gericht.zutaten])
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
      const res = await fetch('/api/gerichte/' + gerichtId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zutaten: bearbeiteZutaten })
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      const updated = await fetch('/api/gerichte').then(r => r.json())
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
    await fetch(`/api/gerichte/${id}/reaktivieren`, { method: 'PATCH' })
    const updated = await fetch('/api/gerichte').then(r => r.json())
    setGerichte(updated)
    setMeldung('✅ Gericht reaktiviert')
  }

  async function vorschlaegeGenerieren() {
    setLadeVorschlaege(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/gerichte/vorschlaege', {
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
      const res = await fetch('/api/gerichte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vorschlag.name,
          kategorie: vorschlag.kategorie,
          aufwand: vorschlag.aufwand,
          gesund: false,
          quelle: 'themealdb',
        }),
      })
      if (!res.ok) throw new Error('Anlegen fehlgeschlagen')
      const neuesGericht = await res.json()

      await fetch('/api/zutaten/generieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gerichtId: neuesGericht.id }),
      })

      const updated = await fetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setVorschlaege(prev => prev.filter(v => v.name !== vorschlag.name))
      setMeldung(`✅ ${vorschlag.name} hinzugefügt und Zutaten generiert`)
    } catch (e: unknown) {
      setMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setFuegeHinzu(null)
    }
  }

  async function loeschen(id: string) {
    setLoescht(id)
    try {
      await fetch(`/api/gerichte/${id}`, { method: 'DELETE' })
      const updated = await fetch('/api/gerichte').then(r => r.json())
      setGerichte(updated)
      setMeldung('✅ Gericht gelöscht')
    } finally {
      setLoescht(null)
    }
  }

  const aktiveGerichte = gerichte.filter(g => !g.gesperrt)
  const gesperrteGerichte = gerichte.filter(g => g.gesperrt)
  const ohneZutaten = aktiveGerichte.filter(g => g.zutaten.length === 0).length

  return (
    <main className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🥘 Gerichte & Zutaten</h1>
          {ohneZutaten > 0 && (
            <p className="text-sm text-amber-600 mt-1">
              ⚠️ {ohneZutaten} Gerichte haben noch keine Zutaten
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href="/wochenplan"
            className="text-gray-600 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Wochenplan
          </a>
          <button
            onClick={alleZutatenGenerieren}
            disabled={generiere}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {generiere ? 'Generiere...' : '✨ Alle Zutaten generieren'}
          </button>
        </div>
      </div>

      {meldung && (
        <p className="text-sm mb-4 p-3 bg-gray-50 rounded-lg">{meldung}</p>
      )}

      {/* Neue Gerichte entdecken */}
      <div className="mb-8 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <h2 className="text-base font-semibold text-gray-700 mb-3">Neue Gerichte entdecken</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={vorschlagHinweis}
            onChange={e => setVorschlagHinweis(e.target.value)}
            placeholder="Worauf habt ihr Lust? (optional, z.B. mehr Fisch)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={vorschlaegeGenerieren}
            disabled={ladeVorschlaege}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0"
          >
            {ladeVorschlaege ? 'Generiere...' : '3 Vorschläge generieren'}
          </button>
        </div>

        {vorschlaege.length > 0 && (
          <div className="space-y-3">
            {vorschlaege.map(v => (
              <div key={v.name} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{v.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{v.beschreibung}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                        {v.kategorie}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                        {v.aufwand}
                      </span>
                      {v.rezept_url && (
                        <a
                          href={v.rezept_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Rezept ansehen →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => vorschlagHinzufuegen(v)}
                      disabled={fuegeHinzu === v.name}
                      className="text-sm bg-green-600 text-white rounded px-3 py-1.5 hover:bg-green-700 disabled:opacity-50"
                    >
                      {fuegeHinzu === v.name ? 'Füge hinzu...' : 'Hinzufügen'}
                    </button>
                    <button
                      onClick={() => setVorschlaege(prev => prev.filter(x => x.name !== v.name))}
                      className="text-sm text-gray-400 hover:text-gray-600 rounded px-3 py-1.5"
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

      <div className="space-y-3">
        {aktiveGerichte.map(gericht => (
          <div key={gericht.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-medium text-gray-900">{gericht.name}</h2>
                {bearbeiteId !== gericht.id && (
                  <p className="text-sm text-gray-500 mt-1">
                    {gericht.zutaten.length === 0
                      ? 'Keine Zutaten'
                      : gericht.zutaten.map(z => `${z.menge}${z.einheit} ${z.name}`).join(', ')}
                  </p>
                )}
              </div>
              {bearbeiteId !== gericht.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => einzelnGenerieren(gericht)}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    neu generieren
                  </button>
                  <button
                    onClick={() => bearbeiteStart(gericht)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    ✏️ bearbeiten
                  </button>
                </div>
              )}
            </div>

            {bearbeiteId === gericht.id && (
              <div className="mt-3 space-y-2">
                {bearbeiteZutaten.map((zutat, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      value={zutat.name}
                      onChange={e => zutatAendern(i, 'name', e.target.value)}
                      placeholder="Name"
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                    />
                    <input
                      type="number"
                      value={zutat.menge}
                      onChange={e => zutatAendern(i, 'menge', parseFloat(e.target.value))}
                      className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                    />
                    <select
                      value={zutat.einheit}
                      onChange={e => zutatAendern(i, 'einheit', e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      {['g', 'kg', 'ml', 'l', 'Stück', 'EL', 'TL', 'Bund', 'Packung'].map(e => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={zutat.haltbarkeit_tage}
                      onChange={e => zutatAendern(i, 'haltbarkeit_tage', parseInt(e.target.value))}
                      title="Haltbarkeit in Tagen"
                      className="w-16 text-sm border border-gray-300 rounded px-2 py-1"
                    />
                    <span className="text-xs text-gray-400">Tage</span>
                    <button
                      onClick={() => zutatEntfernen(i)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={zutatHinzufuegen}
                    className="text-sm text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 rounded px-3 py-1"
                  >
                    + Zutat hinzufügen
                  </button>
                  <button
                    onClick={() => speichern(gericht.id)}
                    disabled={speichere}
                    className="text-sm bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {speichere ? 'Speichere...' : 'Speichern'}
                  </button>
                  <button
                    onClick={() => setBearbeiteId(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {gesperrteGerichte.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Gesperrt ({gesperrteGerichte.length})
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Diese Gerichte wurden zu oft getauscht und werden nicht mehr vorgeschlagen.
          </p>
          <div className="space-y-2">
            {gesperrteGerichte.map(gericht => (
              <div
                key={gericht.id}
                className="border border-red-200 bg-red-50 rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-gray-800">{gericht.name}</p>
                  <p className="text-xs text-red-500 mt-1">
                    {gericht.tausch_count}x getauscht
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reaktivieren(gericht.id)}
                    className="text-sm text-green-600 hover:text-green-800 border border-green-300 rounded px-3 py-1"
                  >
                    Reaktivieren
                  </button>
                  <button
                    onClick={() => loeschen(gericht.id)}
                    disabled={loescht === gericht.id}
                    className="text-sm text-red-600 hover:text-red-800 border border-red-300 rounded px-3 py-1 disabled:opacity-50"
                  >
                    {loescht === gericht.id ? 'Löscht...' : 'Löschen'}
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
