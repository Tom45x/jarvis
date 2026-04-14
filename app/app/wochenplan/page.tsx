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
    <main className="min-h-screen bg-white pb-32">
      {/* Header — nur Titel + Status, kein Button oben */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
          Diese Woche
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--gray-secondary)' }}>
          {plan
            ? plan.status === 'genehmigt' ? '✓ Genehmigt' : 'Entwurf — noch nicht genehmigt'
            : 'Noch kein Plan für diese Woche'}
        </p>
        {error && (
          <p className="mt-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#fff0f3', color: 'var(--rausch)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Plan */}
      {plan ? (
        <>
          <WochenplanGrid
            plan={plan}
            gerichte={gerichte}
            onTauschen={tauschen}
            onGenehmigen={genehmigen}
          />

          {/* Drinks */}
          {drinks.length > 0 && (
            <div className="px-4 mt-8">
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
        /* Leerer Zustand */
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--near-black)' }}>
            Noch kein Plan
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--gray-secondary)' }}>
            Lass Jarvis einen Wochenplan für euch erstellen
          </p>
        </div>
      )}

      {/* Thumb-Zone Action Bar — fest unten, über der BottomNav */}
      <div
        className="fixed left-0 right-0 px-4 pb-2 pt-3 z-40"
        style={{
          bottom: '64px', // Höhe der BottomNav
          background: 'linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0))',
        }}
      >
        {einkaufMeldung && (
          <p className="text-xs text-center mb-2" style={{ color: 'var(--gray-secondary)' }}>
            {einkaufMeldung}
          </p>
        )}
        <div className="flex gap-3">
          {/* Einkaufsliste — primäre Aktion, größer */}
          {plan && (
            <button
              onClick={einkaufslisteSenden}
              disabled={einkaufLoading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
              style={{ background: 'var(--near-black)', color: '#ffffff', minHeight: '52px' }}
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
          )}
          {/* Neuer Plan — sekundär */}
          <button
            onClick={generieren}
            disabled={loading}
            className="flex items-center justify-center rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
            style={{
              background: 'var(--rausch)',
              color: '#ffffff',
              minHeight: '52px',
              minWidth: plan ? '52px' : '100%',
              width: plan ? '52px' : '100%',
            }}
          >
            {loading ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : plan ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
              </svg>
            ) : '✨ Plan erstellen'}
          </button>
        </div>
      </div>
    </main>
  )
}
