'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import type { Wochenplan, Mahlzeit } from '@/types'

const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const
type Tag = typeof TAGE[number]

const TAG_SHORT: Record<Tag, string> = {
  montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi', donnerstag: 'Do',
  freitag: 'Fr', samstag: 'Sa', sonntag: 'So',
}

const MAHLZEITEN: Mahlzeit[] = ['frühstück', 'mittag', 'abend']

const MAHLZEIT_LABEL: Record<Mahlzeit, string> = {
  frühstück: 'Früh',
  mittag: 'Mittag',
  abend: 'Abend',
}

const JS_TAGE = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']

function istHeute(tag: Tag): boolean {
  return JS_TAGE[new Date().getDay()] === tag
}

export default function WochenplanUebersichtPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<Wochenplan | null>(null)
  const [istLandscape, setIstLandscape] = useState(false)

  useEffect(() => {
    apiFetch('/api/wochenplan')
      .then(r => r.ok ? r.json() : null)
      .then((data: { aktiverPlan: Wochenplan | null } | null) => {
        if (data?.aktiverPlan) setPlan(data.aktiverPlan)
      })
      .catch((e) => console.error('Wochenplan konnte nicht geladen werden:', e))
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    setIstLandscape(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIstLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function gerichtName(tag: Tag, mahlzeit: Mahlzeit): string {
    return plan?.eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit)?.gericht_name ?? '—'
  }

  const backButton = (
    <button
      onClick={() => router.back()}
      aria-label="Zurück"
      className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
      style={{ color: 'var(--rausch)' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  )

  // ── Portrait Layout ──────────────────────────────────────────────
  if (!istLandscape) {
    return (
      <main className="min-h-screen bg-white pb-24">
        <div className="px-4 pt-12 pb-4 flex items-center gap-3">
          {backButton}
          <h1 className="text-xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
            Diese Woche
          </h1>
        </div>

        <div className="px-4 space-y-1.5">
          {TAGE.map(tag => (
            <div
              key={tag}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 1fr', gap: '6px', alignItems: 'center' }}
            >
              {/* Kreis-Icon */}
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: istHeute(tag) ? 'var(--rausch)' : 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: istHeute(tag) ? '#ffffff' : 'var(--near-black)',
                  flexShrink: 0,
                }}
              >
                {TAG_SHORT[tag]}
              </div>

              {/* Mahlzeit-Karten */}
              {MAHLZEITEN.map(mahlzeit => (
                <div
                  key={mahlzeit}
                  className="rounded-lg"
                  style={{ background: '#fffbf0', padding: '6px 8px', boxShadow: 'var(--card-shadow)' }}
                >
                  <p style={{ fontSize: '9px', color: 'var(--gray-secondary)', marginBottom: '2px' }}>
                    {MAHLZEIT_LABEL[mahlzeit]}
                  </p>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--near-black)', lineHeight: '1.2' }}>
                    {gerichtName(tag, mahlzeit)}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </main>
    )
  }

  // ── Landscape Layout ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white pb-8">
      <div className="px-4 pt-6 pb-3 flex items-center gap-3">
        {backButton}
        <h1 className="text-lg font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
          Diese Woche
        </h1>
      </div>

      <div className="px-4">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '44px repeat(7, 1fr)',
            gap: '4px',
          }}
        >
          {/* Leer-Ecke oben links */}
          <div />

          {/* Tag-Spalten-Header */}
          {TAGE.map(tag => (
            <div key={tag} style={{ display: 'flex', justifyContent: 'center', paddingBottom: '4px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: istHeute(tag) ? 'var(--rausch)' : 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: istHeute(tag) ? '#ffffff' : 'var(--near-black)',
                }}
              >
                {TAG_SHORT[tag]}
              </div>
            </div>
          ))}

          {/* Mahlzeit-Zeilen */}
          {MAHLZEITEN.map(mahlzeit => (
            <React.Fragment key={mahlzeit}>
              {/* Zeilen-Label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--gray-secondary)',
                  paddingRight: '6px',
                }}
              >
                {MAHLZEIT_LABEL[mahlzeit]}
              </div>

              {/* Zellen */}
              {TAGE.map(tag => (
                <div
                  key={`${tag}-${mahlzeit}`}
                  className="rounded-lg"
                  style={{
                    background: '#fffbf0',
                    padding: '6px 4px',
                    textAlign: 'center',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--near-black)', lineHeight: '1.3' }}>
                    {gerichtName(tag, mahlzeit)}
                  </p>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </main>
  )
}
