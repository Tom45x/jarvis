'use client'

import { useEffect, useState } from 'react'
import type { Regelbedarf } from '@/types'

export default function EinstellungenPage() {
  const [regelbedarf, setRegelbedarf] = useState<Regelbedarf[]>([])
  const [neuerName, setNeuerName] = useState('')
  const [neueMenge, setNeueMenge] = useState('')
  const [neueEinheit, setNeueEinheit] = useState('Packung')
  const [mindestbestellwert, setMindestbestellwert] = useState('35')
  const [bringKeywords, setBringKeywords] = useState<string[]>([])
  const [neuesKeyword, setNeuesKeyword] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [speichere, setSpeichere] = useState(false)

  useEffect(() => {
    fetch('/api/einstellungen/regelbedarf').then(r => r.json()).then(setRegelbedarf)
    fetch('/api/einstellungen').then(r => r.json()).then((data: Record<string, string>) => {
      setMindestbestellwert(data['picnic_mindestbestellwert'] ?? '35')
      try {
        setBringKeywords(JSON.parse(data['picnic_bring_keywords'] ?? '[]'))
      } catch {
        setBringKeywords([])
      }
    })
  }, [])

  async function regelbedarfHinzufuegen() {
    if (!neuerName || !neueMenge) return
    const res = await fetch('/api/einstellungen/regelbedarf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: neuerName, menge: parseFloat(neueMenge), einheit: neueEinheit }),
    })
    if (res.ok) {
      setRegelbedarf(await fetch('/api/einstellungen/regelbedarf').then(r => r.json()))
      setNeuerName('')
      setNeueMenge('')
    }
  }

  async function regelbedarfLoeschen(id: string) {
    await fetch(`/api/einstellungen/regelbedarf/${id}`, { method: 'DELETE' })
    setRegelbedarf(prev => prev.filter(r => r.id !== id))
  }

  async function picnicEinstellungenSpeichern() {
    setSpeichere(true)
    try {
      await fetch('/api/einstellungen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          picnic_mindestbestellwert: mindestbestellwert,
          picnic_bring_keywords: JSON.stringify(bringKeywords),
        }),
      })
      setMeldung('✅ Einstellungen gespeichert')
    } catch {
      setMeldung('❌ Fehler beim Speichern')
    } finally {
      setSpeichere(false)
    }
  }

  function keywordHinzufuegen() {
    if (!neuesKeyword || bringKeywords.includes(neuesKeyword)) return
    setBringKeywords(prev => [...prev, neuesKeyword])
    setNeuesKeyword('')
  }

  function keywordEntfernen(kw: string) {
    setBringKeywords(prev => prev.filter(k => k !== kw))
  }

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <a
          href="/wochenplan"
          className="text-gray-600 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Wochenplan
        </a>
      </div>

      {meldung && (
        <p className="text-sm mb-4 p-3 bg-gray-50 rounded-lg">{meldung}</p>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Regelbedarf (Picnic)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Diese Artikel werden bei jeder Einkaufsliste automatisch zu Picnic hinzugefügt.
        </p>
        <div className="space-y-2 mb-4">
          {regelbedarf.map(r => (
            <div key={r.id} className="flex justify-between items-center border border-gray-200 rounded-lg p-3">
              <span className="text-sm text-gray-800">
                {r.menge} {r.einheit} {r.name}
              </span>
              <button
                onClick={() => regelbedarfLoeschen(r.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Entfernen
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={neuerName}
            onChange={e => setNeuerName(e.target.value)}
            placeholder="Artikel (z.B. Toast)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <input
            value={neueMenge}
            onChange={e => setNeueMenge(e.target.value)}
            placeholder="Menge"
            type="number"
            className="w-20 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <select
            value={neueEinheit}
            onChange={e => setNeueEinheit(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            {['Packung', 'Stück', 'l', 'g', 'kg'].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <button
            onClick={regelbedarfHinzufuegen}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Hinzufügen
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Picnic Mindestbestellwert</h2>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            value={mindestbestellwert}
            onChange={e => setMindestbestellwert(e.target.value)}
            className="w-24 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <span className="text-sm text-gray-600">€</span>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Bring-Kategorien (immer persönlich einkaufen)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Zutaten deren Name eines dieser Stichworte enthält gehen immer nach Bring.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {bringKeywords.map(kw => (
            <span
              key={kw}
              className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-sm rounded-full px-3 py-1"
            >
              {kw}
              <button
                onClick={() => keywordEntfernen(kw)}
                className="text-orange-500 hover:text-orange-800 ml-1"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={neuesKeyword}
            onChange={e => setNeuesKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && keywordHinzufuegen()}
            placeholder="Neues Stichwort (z.B. Lachs)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={keywordHinzufuegen}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            + Hinzufügen
          </button>
        </div>
      </section>

      <button
        onClick={picnicEinstellungenSpeichern}
        disabled={speichere}
        className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
      >
        {speichere ? 'Speichere...' : 'Alle Einstellungen speichern'}
      </button>
    </main>
  )
}
