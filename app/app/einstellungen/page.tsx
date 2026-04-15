'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
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
    apiFetch('/api/einstellungen/regelbedarf').then(r => r.json()).then(setRegelbedarf)
    apiFetch('/api/einstellungen').then(r => r.json()).then((data: Record<string, string>) => {
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
    const res = await apiFetch('/api/einstellungen/regelbedarf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: neuerName, menge: parseFloat(neueMenge), einheit: neueEinheit }),
    })
    if (res.ok) {
      setRegelbedarf(await apiFetch('/api/einstellungen/regelbedarf').then(r => r.json()))
      setNeuerName('')
      setNeueMenge('')
    }
  }

  async function regelbedarfLoeschen(id: string) {
    await apiFetch(`/api/einstellungen/regelbedarf/${id}`, { method: 'DELETE' })
    setRegelbedarf(prev => prev.filter(r => r.id !== id))
  }

  async function picnicEinstellungenSpeichern() {
    setSpeichere(true)
    try {
      await apiFetch('/api/einstellungen', {
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

  const inputStyle = {
    border: '1.5px solid var(--border)',
    color: 'var(--near-black)',
    background: '#ffffff',
    borderRadius: '12px',
    padding: '12px 14px',
    fontSize: '16px', // prevents iOS zoom on focus
    outline: 'none',
    width: '100%',
    minHeight: '48px',
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
          Einstellungen
        </h1>
      </div>

      {meldung && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>
          {meldung}
        </div>
      )}

      <div className="px-4 space-y-6 pb-6">

        {/* Regelbedarf */}
        <section className="rounded-2xl p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--near-black)' }}>
            Regelbedarf (Picnic)
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--gray-secondary)' }}>
            Wird bei jeder Einkaufsliste automatisch zu Picnic hinzugefügt.
          </p>

          <div className="space-y-2 mb-4">
            {regelbedarf.map(r => (
              <div
                key={r.id}
                className="flex justify-between items-center rounded-xl px-3 py-2.5"
                style={{ background: 'var(--surface)' }}
              >
                <span className="text-sm" style={{ color: 'var(--near-black)' }}>
                  {r.menge} {r.einheit} {r.name}
                </span>
                <button
                  onClick={() => regelbedarfLoeschen(r.id)}
                  className="text-xs font-medium"
                  style={{ color: 'var(--rausch)' }}
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
              placeholder="Artikel"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              value={neueMenge}
              onChange={e => setNeueMenge(e.target.value)}
              placeholder="Menge"
              type="number"
              style={{ ...inputStyle, width: '72px' }}
            />
            <select
              value={neueEinheit}
              onChange={e => setNeueEinheit(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}
            >
              {['Packung', 'Stück', 'l', 'g', 'kg'].map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <button
              onClick={regelbedarfHinzufuegen}
              className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--near-black)', color: '#ffffff' }}
            >
              +
            </button>
          </div>
        </section>

        {/* Picnic Mindestbestellwert */}
        <section className="rounded-2xl p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--near-black)' }}>
            Picnic Mindestbestellwert
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--gray-secondary)' }}>
            Unter diesem Betrag gehen Artikel zu Bring statt Picnic.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={mindestbestellwert}
              onChange={e => setMindestbestellwert(e.target.value)}
              style={{ ...inputStyle, width: '96px' }}
            />
            <span className="text-sm font-medium" style={{ color: 'var(--near-black)' }}>€</span>
          </div>
        </section>

        {/* Bring Keywords */}
        <section className="rounded-2xl p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--near-black)' }}>
            Bring-Kategorien
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--gray-secondary)' }}>
            Zutaten mit diesen Stichworten gehen immer zu Bring (z.B. frische Waren).
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {bringKeywords.map(kw => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full"
                style={{ background: '#fff0f3', color: 'var(--rausch)' }}
              >
                {kw}
                <button
                  onClick={() => keywordEntfernen(kw)}
                  className="text-xs leading-none"
                  style={{ color: 'var(--rausch)' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={neuesKeyword}
              onChange={e => setNeuesKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && keywordHinzufuegen()}
              placeholder="Neues Stichwort"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={keywordHinzufuegen}
              className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl"
              style={{ background: 'var(--near-black)', color: '#ffffff' }}
            >
              +
            </button>
          </div>
        </section>

        {/* Speichern */}
        <button
          onClick={picnicEinstellungenSpeichern}
          disabled={speichere}
          className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--rausch)', color: '#ffffff' }}
        >
          {speichere ? 'Speichere...' : 'Einstellungen speichern'}
        </button>
      </div>
    </main>
  )
}
