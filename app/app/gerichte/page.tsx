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
