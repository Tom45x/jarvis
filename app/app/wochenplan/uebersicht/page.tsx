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

const MAHLZEITEN: Mahlzeit[] = ['mittag', 'abend']

const MAHLZEIT_LABEL: Record<'mittag' | 'abend', string> = {
  mittag: 'Mittag',
  abend: 'Abend',
}

const JS_TAGE = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']

function istHeute(tag: Tag): boolean {
  return JS_TAGE[new Date().getDay()] === tag
}

const BOTTOM_NAV_HEIGHT = 64

export default function WochenplanUebersichtPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<Wochenplan | null>(null)
  const [istLandscape, setIstLandscape] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    apiFetch('/api/wochenplan')
      .then(r => r.ok ? r.json() : null)
      .then((data: { aktiverPlan: Wochenplan | null } | null) => {
        if (data?.aktiverPlan) setPlan(data.aktiverPlan)
      })
      .catch((e) => console.error('Wochenplan konnte nicht geladen werden:', e))
  }, [])

  useEffect(() => {
    const update = () => {
      setIstLandscape(window.innerWidth > window.innerHeight)
      setViewportHeight(window.innerHeight)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  function gerichtName(tag: Tag, mahlzeit: 'mittag' | 'abend'): string {
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

        <div
          className="px-4"
          style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 1fr',
            gridAutoRows: '62px',
            gap: '4px',
          }}
        >
          {TAGE.map(tag => (
            <React.Fragment key={tag}>
              {/* Kreis-Icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
              </div>

              {/* Mahlzeit-Karten */}
              {MAHLZEITEN.map(mahlzeit => (
                <div
                  key={mahlzeit}
                  className="rounded-lg"
                  style={{
                    background: '#fffbf0',
                    boxShadow: 'var(--card-shadow)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    paddingTop: '5px',
                    paddingInline: '8px',
                    paddingBottom: '4px',
                  }}
                >
                  <p style={{ fontSize: '9px', color: 'var(--gray-secondary)', marginBottom: '3px', flexShrink: 0 }}>
                    {MAHLZEIT_LABEL[mahlzeit]}
                  </p>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--near-black)', lineHeight: '1.2', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {gerichtName(tag, mahlzeit)}
                    </p>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </main>
    )
  }

  // ── Landscape Layout ─────────────────────────────────────────────
  return (
    <main style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: viewportHeight > 0 ? viewportHeight - BOTTOM_NAV_HEIGHT : undefined, background: 'white', overflow: 'hidden' }}>
      <div className="px-4 pt-5 pb-2 flex items-center gap-3">
        {backButton}
        <h1 className="text-lg font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
          Diese Woche
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', paddingInline: '16px', paddingBottom: '8px', minHeight: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'auto 76px 76px',
            gap: '4px',
            width: '100%',
          }}
        >
          {/* Tag-Header */}
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
              {TAGE.map(tag => (
                <div
                  key={`${tag}-${mahlzeit}`}
                  className="rounded-lg"
                  style={{
                    background: '#fffbf0',
                    boxShadow: 'var(--card-shadow)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    overflow: 'hidden',
                    paddingTop: '6px',
                    paddingInline: '4px',
                    paddingBottom: '4px',
                  }}
                >
                  <p style={{ fontSize: '8px', color: 'var(--gray-secondary)', marginBottom: '3px', flexShrink: 0 }}>
                    {MAHLZEIT_LABEL[mahlzeit]}
                  </p>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <p style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--near-black)',
                      lineHeight: '1.2',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {gerichtName(tag, mahlzeit)}
                    </p>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </main>
  )
}
