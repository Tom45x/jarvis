'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { PutzAufgabe, Putzplan } from '@/types'

type Tab = number | 'quartal' | 'jahr' // 1=Mo … 5=Fr

const TAGE = [
  { tag: 1, kurz: 'Mo' },
  { tag: 2, kurz: 'Di' },
  { tag: 3, kurz: 'Mi' },
  { tag: 4, kurz: 'Do' },
  { tag: 5, kurz: 'Fr' },
]

const QUARTALSENDE = ['März', 'Juni', 'September', 'Dezember']

function aufgabenFuer(aufgaben: PutzAufgabe[], tab: Tab): PutzAufgabe[] {
  return typeof tab === 'number'
    ? aufgaben.filter(a => (a.rhythmus === 'woche' || a.rhythmus === 'monat') && a.wochentag === tab)
    : aufgaben.filter(a => a.rhythmus === tab)
}

function erledigtDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
}

export default function PutzplanPage() {
  const [plan, setPlan] = useState<Putzplan | null>(null)
  const [tab, setTab] = useState<Tab>(1)
  const [meldung, setMeldung] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/putzplan')
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((data: Putzplan) => {
        setPlan(data)
        // Am Wochenende auf Montag springen
        setTab(data.heute <= 5 ? data.heute : 1)
      })
      .catch(() => setMeldung('❌ Putzplan konnte nicht geladen werden'))
  }, [])

  function setzeErledigt(id: string, erledigt: boolean, erledigt_am: string | null) {
    setPlan(prev => prev && {
      ...prev,
      aufgaben: prev.aufgaben.map(a => (a.id === id ? { ...a, erledigt, erledigt_am } : a)),
    })
  }

  async function umschalten(aufgabe: PutzAufgabe) {
    const neu = !aufgabe.erledigt
    setMeldung(null)
    // Optimistisch: Haken sofort zeigen, bei Fehler zurücknehmen
    setzeErledigt(aufgabe.id, neu, neu ? new Date().toISOString() : null)
    try {
      const res = await apiFetch(`/api/putzplan/${aufgabe.id}`, { method: neu ? 'POST' : 'DELETE' })
      if (!res.ok) throw new Error()
      if (neu) setzeErledigt(aufgabe.id, true, (await res.json()).erledigt_am)
    } catch {
      setzeErledigt(aufgabe.id, aufgabe.erledigt, aufgabe.erledigt_am)
      setMeldung('❌ Konnte nicht gespeichert werden – bitte nochmal versuchen')
    }
  }

  const aufgaben = plan?.aufgaben ?? []
  const offen = (t: Tab) => aufgabenFuer(aufgaben, t).filter(a => !a.erledigt).length
  const sichtbar = aufgabenFuer(aufgaben, tab)
  const quartalsNr = plan ? Number(plan.quartal.slice(-1)) : 1

  const sektionen: { titel: string; hinweis?: string; liste: PutzAufgabe[] }[] =
    tab === 'quartal'
      ? [{ titel: 'Dieses Quartal', hinweis: `bis Ende ${QUARTALSENDE[quartalsNr - 1]}`, liste: sichtbar }]
      : tab === 'jahr'
      ? [{ titel: 'Dieses Jahr', hinweis: 'bis Ende Dezember', liste: sichtbar }]
      : [
          { titel: 'Diese Woche', liste: sichtbar.filter(a => a.rhythmus === 'woche') },
          { titel: 'Diesen Monat', liste: sichtbar.filter(a => a.rhythmus === 'monat') },
        ]

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
          Putzplan
        </h1>
      </div>

      {/* Tage */}
      <div className="flex gap-1.5 px-4 pt-1 pb-4">
        {[
          ...TAGE.map(t => ({ id: t.tag as Tab, label: t.kurz })),
          { id: 'quartal' as Tab, label: 'Quartal' },
          { id: 'jahr' as Tab, label: 'Jahr' },
        ].map(t => {
          const aktiv = tab === t.id
          const anzahl = offen(t.id)
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative h-10 rounded-full text-sm font-semibold ${typeof t.id === 'number' ? 'flex-1' : 'px-3'}`}
              style={{
                background: aktiv ? 'var(--near-black)' : 'var(--surface)',
                color: aktiv ? '#ffffff' : 'var(--near-black)',
              }}
            >
              {t.label}
              {plan && (
                <span
                  className="absolute -top-1 -right-1 text-[10px] font-semibold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                  style={{
                    background: anzahl === 0 ? 'var(--near-black)' : 'var(--rausch)',
                    color: '#ffffff',
                    border: '2px solid #ffffff',
                  }}
                >
                  {anzahl === 0 ? '✓' : anzahl}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {meldung && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-2xl text-sm" style={{ background: 'var(--surface)', color: 'var(--near-black)' }}>
          {meldung}
        </div>
      )}

      <div className="px-4 space-y-6 pb-6">
        {sektionen.filter(s => s.liste.length > 0).map(s => (
          <section key={s.titel}>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-semibold" style={{ color: 'var(--near-black)' }}>
                {s.titel}
                {s.hinweis && (
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--gray-secondary)' }}>{s.hinweis}</span>
                )}
              </h2>
              <span className="text-xs" style={{ color: 'var(--gray-secondary)' }}>
                {s.liste.filter(a => a.erledigt).length}/{s.liste.length} erledigt
              </span>
            </div>

            <div className="space-y-2">
              {s.liste.map(a => (
                <button
                  key={a.id}
                  onClick={() => umschalten(a)}
                  role="checkbox"
                  aria-checked={a.erledigt}
                  className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
                  style={{ boxShadow: 'var(--card-shadow)', background: '#ffffff' }}
                >
                  <span className="shrink-0 w-11 h-11 flex items-center justify-center">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                      style={{
                        background: a.erledigt ? 'var(--rausch)' : '#ffffff',
                        border: a.erledigt ? 'none' : '2px solid var(--gray-disabled)',
                      }}
                    >
                      {a.erledigt && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </span>
                  <span className="flex-1 min-w-0" style={{ opacity: a.erledigt ? 0.5 : 1 }}>
                    <span
                      className="block text-sm font-medium"
                      style={{ color: 'var(--near-black)', textDecoration: a.erledigt ? 'line-through' : 'none' }}
                    >
                      {a.titel}
                    </span>
                    {a.beschreibung && (
                      <span className="block text-xs mt-0.5" style={{ color: 'var(--gray-secondary)' }}>{a.beschreibung}</span>
                    )}
                    {a.erledigt && a.erledigt_am && (
                      <span className="block text-xs mt-0.5" style={{ color: 'var(--gray-secondary)' }}>
                        erledigt am {erledigtDatum(a.erledigt_am)}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {plan && sichtbar.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--gray-secondary)' }}>
            Für diesen Tag sind keine Aufgaben eingetragen.
          </p>
        )}
      </div>
    </main>
  )
}
