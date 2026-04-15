'use client'

import { useEffect, useRef, useState } from 'react'
import type { Gericht, Mahlzeit } from '@/types'
import { SONDERKATEGORIEN } from '@/lib/sonderkategorien'

const TAG_LABEL: Record<string, string> = {
  montag: 'Montag', dienstag: 'Dienstag', mittwoch: 'Mittwoch',
  donnerstag: 'Donnerstag', freitag: 'Freitag', samstag: 'Samstag', sonntag: 'Sonntag',
}

const MAHLZEIT_LABEL: Record<Mahlzeit, string> = {
  frühstück: 'Frühstück', mittag: 'Mittag', abend: 'Abend',
}

interface GerichtPickerSheetProps {
  gerichte: Gericht[]
  tag: string
  mahlzeit: Mahlzeit
  aktuelleGerichtId?: string
  onWaehlen: (gericht: Gericht) => void
  onClose: () => void
}

export function GerichtPickerSheet({ gerichte, tag, mahlzeit, aktuelleGerichtId, onWaehlen, onClose }: GerichtPickerSheetProps) {
  const [visible, setVisible] = useState(false)
  const [suche, setSuche] = useState('')
  const touchStartY = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sonderKategorie = mahlzeit === 'frühstück'
    ? 'frühstück'
    : SONDERKATEGORIEN[`${tag}-${mahlzeit}`] ?? null

  const gefiltert = gerichte.filter(g => {
    if (g.gesperrt) return false
    const passeKategorie = sonderKategorie
      ? g.kategorie === sonderKategorie
      : g.kategorie !== 'frühstück' && g.kategorie !== 'trainingstage' && g.kategorie !== 'filmabend'
    const passSuche = suche.trim() === '' || g.name.toLowerCase().includes(suche.toLowerCase())
    return passeKategorie && passSuche
  }).sort((a, b) => (b.bewertung ?? 3) - (a.bewertung ?? 3))

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => {
      setVisible(true)
      setTimeout(() => inputRef.current?.focus(), 300)
    })
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleTouchStart(e: React.TouchEvent) { touchStartY.current = e.touches[0].clientY }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    if (e.touches[0].clientY - touchStartY.current > 80) { touchStartY.current = null; onClose() }
  }
  function handleTouchEnd() { touchStartY.current = null }

  return (
    <>
      <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Gericht wählen"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl flex flex-col"
        style={{
          background: '#ffffff',
          maxHeight: '85vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 shrink-0"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 shrink-0">
          <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--gray-secondary)' }}>
            {TAG_LABEL[tag]} · {MAHLZEIT_LABEL[mahlzeit]}
          </p>
          <h2 className="text-lg font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
            Gericht wählen
          </h2>
        </div>

        {/* Suchfeld */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--surface)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gray-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="Suchen…"
              className="flex-1 bg-transparent outline-none py-3 text-sm"
              style={{ color: 'var(--near-black)' }}
            />
            {suche && (
              <button onClick={() => setSuche('')} style={{ color: 'var(--gray-secondary)' }}>✕</button>
            )}
          </div>
        </div>

        {/* Liste */}
        <div className="overflow-y-auto px-5 pb-8">
          {gefiltert.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--gray-secondary)' }}>
              Keine Gerichte gefunden
            </p>
          ) : (
            <ul className="space-y-2">
              {gefiltert.map(g => {
                const istAktuell = g.id === aktuelleGerichtId
                return (
                  <li key={g.id}>
                    <button
                      onClick={() => { onWaehlen(g); onClose() }}
                      className="w-full text-left rounded-2xl px-4 py-3 flex items-center justify-between gap-3 active:opacity-70 transition-opacity"
                      style={{
                        background: istAktuell ? 'var(--rausch)' : '#fffbf0',
                        boxShadow: 'var(--card-shadow)',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: istAktuell ? '#ffffff' : 'var(--near-black)' }}>
                          {g.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: istAktuell ? 'rgba(255,255,255,0.75)' : 'var(--gray-secondary)' }}>
                          {g.kategorie}{g.gesund ? ' · gesund' : ''}
                        </p>
                      </div>
                      {(g.bewertung ?? 3) === 5 && (
                        <span className="text-sm shrink-0">⭐</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
