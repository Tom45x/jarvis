'use client'

import { useEffect, useState } from 'react'
import { WochenplanGrid } from '@/components/WochenplanGrid'
import type { Wochenplan, Gericht, DrinkVorschlag } from '@/types'

export default function WochenplanPage() {
  const [plan, setPlan] = useState<Wochenplan | null>(null)
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [drinks, setDrinks] = useState<DrinkVorschlag[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [einkaufLoading, setEinkaufLoading] = useState(false)
  const [einkaufMeldung, setEinkaufMeldung] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/gerichte').then(r => r.json()).then(setGerichte)
    fetch('/api/wochenplan').then(r => r.ok ? r.json() : null).then(setPlan)
  }, [])

  async function generieren() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wochenplan/generate', { method: 'POST' })
      if (!res.ok) throw new Error('Fehler beim Generieren')
      const data = await res.json()
      setPlan(data)
      setDrinks(data.drinks ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function tauschen(tag: string, mahlzeit: string) {
    if (!plan) return
    const aktuell = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const andere = gerichte.filter(g =>
      g.id !== aktuell?.gericht_id &&
      !g.gesperrt &&
      (mahlzeit === 'frühstück'
        ? g.kategorie === 'frühstück'
        : g.kategorie !== 'frühstück' && g.kategorie !== 'trainingstage')
    )
    const neu = andere[Math.floor(Math.random() * andere.length)]
    if (!neu) return

    const eintraege = plan.eintraege.map(e =>
      e.tag === tag && e.mahlzeit === mahlzeit
        ? { ...e, gericht_id: neu.id, gericht_name: neu.name }
        : e
    )
    const res = await fetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege, status: plan.status })
    })
    setPlan(await res.json())

    if (aktuell?.gericht_id) {
      fetch(`/api/gerichte/${aktuell.gericht_id}/tauschen`, { method: 'PATCH' }).catch(() => {})
    }
  }

  async function genehmigen() {
    if (!plan) return
    const res = await fetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege: plan.eintraege, status: 'genehmigt' })
    })
    setPlan(await res.json())
  }

  async function einkaufslisteSenden() {
    setEinkaufLoading(true)
    setEinkaufMeldung(null)
    try {
      const res = await fetch('/api/einkaufsliste/senden', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      const picnicArtikel = data.picnic1Count ?? 0
      const picnicInfo = picnicArtikel > 0 ? ` · Picnic: ${picnicArtikel}` : ''
      setEinkaufMeldung(
        `✅ Bring: ${(data.einkauf1Count ?? 0) + (data.einkauf2Count ?? 0)} Artikel${picnicInfo}`
      )
    } catch (e: unknown) {
      setEinkaufMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setEinkaufLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
              Diese Woche
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--gray-secondary)' }}>
              {plan?.status === 'genehmigt' ? '✓ Genehmigt' : 'Entwurf'}
            </p>
          </div>
          <button
            onClick={generieren}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--rausch)', color: '#ffffff' }}
          >
            {loading ? '...' : '✨ Neuer Plan'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#fff0f3', color: 'var(--rausch)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Plan or empty state */}
      {plan ? (
        <>
          <WochenplanGrid
            plan={plan}
            gerichte={gerichte}
            onTauschen={tauschen}
            onGenehmigen={genehmigen}
          />

          {/* Einkaufsliste */}
          <div className="px-4 mt-6">
            <button
              onClick={einkaufslisteSenden}
              disabled={einkaufLoading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              style={{ background: 'var(--near-black)', color: '#ffffff' }}
            >
              {einkaufLoading ? 'Sende...' : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  Einkaufslisten senden
                </>
              )}
            </button>
            {einkaufMeldung && (
              <p className="text-sm text-center mt-2" style={{ color: 'var(--gray-secondary)' }}>
                {einkaufMeldung}
              </p>
            )}
          </div>

          {/* Drinks */}
          {drinks.length > 0 && (
            <div className="px-4 mt-8 mb-4">
              <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--near-black)' }}>
                🥤 Saft-Vorschläge
              </h2>
              <div className="flex gap-3 overflow-x-auto scroll-hide pb-1">
                {drinks.map((drink, i) => (
                  <div
                    key={i}
                    className="shrink-0 rounded-2xl p-4"
                    style={{ width: '180px', background: '#fff8f0', boxShadow: 'var(--card-shadow)' }}
                  >
                    <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{drink.name}</p>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--gray-secondary)' }}>
                      {drink.zutaten.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--near-black)' }}>
            Noch kein Plan
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--gray-secondary)' }}>
            Lass Jarvis einen Wochenplan für euch erstellen
          </p>
          <button
            onClick={generieren}
            disabled={loading}
            className="px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--rausch)', color: '#ffffff' }}
          >
            {loading ? 'Generiere...' : '✨ Plan erstellen'}
          </button>
        </div>
      )}
    </main>
  )
}
