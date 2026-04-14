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
    // Gesperrte Gerichte aus der Zufallsauswahl ausschließen
    const andere = gerichte.filter(g => g.id !== aktuell?.gericht_id && !g.gesperrt)
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

    // Fire-and-forget: Tausch im alten Gericht protokollieren
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
      setEinkaufMeldung(
        `✅ Einkauf 1 (${data.einkauf1Count} Artikel) und Einkauf 2 (${data.einkauf2Count} Artikel) wurden in Bring aktualisiert`
      )
    } catch (e: unknown) {
      setEinkaufMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setEinkaufLoading(false)
    }
  }

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">🍽️ Wochenplan</h1>
        <div className="flex gap-2">
          <a
            href="/gerichte"
            className="text-gray-600 text-sm px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            🥘 Gerichte
          </a>
          <button
            onClick={generieren}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generiere...' : '✨ Neuer Plan'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {plan ? (
        <>
          <WochenplanGrid
            plan={plan}
            gerichte={gerichte}
            onTauschen={tauschen}
            onGenehmigen={genehmigen}
          />
          <div className="mt-6 border-t border-gray-100 pt-6">
            <button
              onClick={einkaufslisteSenden}
              disabled={einkaufLoading}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {einkaufLoading ? 'Sende...' : '🛒 Einkaufslisten in Bring übertragen'}
            </button>
            {einkaufMeldung && (
              <p className="text-sm mt-2 text-gray-600">{einkaufMeldung}</p>
            )}
          </div>
          {drinks.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">🥤 Saft-Vorschläge</h2>
              <div className="grid grid-cols-3 gap-3">
                {drinks.map((drink, i) => (
                  <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="font-medium text-orange-800 text-sm">{drink.name}</p>
                    <p className="text-xs text-orange-600 mt-1">{drink.zutaten.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-4">Noch kein Plan für diese Woche</p>
          <button onClick={generieren} className="text-blue-500 hover:underline">
            Jetzt generieren →
          </button>
        </div>
      )}
    </main>
  )
}
