'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EinkaufsItem } from '@/types'
import { aggregiere } from '@/lib/einkaufsliste'

export interface EinkaufslistenDaten {
  picnic: Array<{ picnicProdukt: string }>
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
  ausVorrat: EinkaufsItem[]
}

interface EinkaufslisteSheetProps {
  daten: EinkaufslistenDaten
  onClose: () => void
}

function ItemListe({ items }: { items: EinkaufsItem[] }) {
  if (items.length === 0) return <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>—</p>
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm flex items-baseline gap-2" style={{ color: 'var(--near-black)' }}>
          <span style={{ color: 'var(--rausch)', flexShrink: 0 }}>·</span>
          <span className="flex-1">{item.name}</span>
          {item.menge > 0 && (
            <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>
              {item.menge} {item.einheit}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function PicnicListe({ items }: { items: Array<{ picnicProdukt: string }> }) {
  if (items.length === 0) return <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>—</p>
  const unique = [...new Set(items.map(i => i.picnicProdukt))]
  return (
    <ul className="space-y-1">
      {unique.map((produkt, i) => (
        <li key={i} className="text-sm flex items-baseline gap-2" style={{ color: 'var(--near-black)' }}>
          <span style={{ color: '#5ba832', flexShrink: 0 }}>·</span>
          <span className="flex-1">{produkt}</span>
        </li>
      ))}
    </ul>
  )
}

export function EinkaufslisteSheet({ daten, onClose }: EinkaufslisteSheetProps) {
  const bring1 = aggregiere(daten.bring1)
  const bring2 = aggregiere(daten.bring2)
  const ausVorrat = daten.ausVorrat
  const picnicUnique = [...new Set(daten.picnic.map(i => i.picnicProdukt))]
  const gesamtArtikel = picnicUnique.length + bring1.length + bring2.length
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => setVisible(true))
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
        aria-labelledby="einkauf-title"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          background: '#ffffff',
          maxHeight: '80vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <div
          className="flex justify-center pt-3 pb-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(80vh - 40px)' }}>
          {/* Header */}
          <div className="flex items-baseline gap-2 mt-2 mb-5">
            <h2
              id="einkauf-title"
              className="text-lg font-bold"
              style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}
            >
              Einkaufsliste
            </h2>
            {gesamtArtikel > 0 && (
              <span className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
                · {gesamtArtikel} Artikel
              </span>
            )}
          </div>

          {/* Wochenplan-Button */}
          <button
            onClick={() => { onClose(); router.push('/wochenplan/uebersicht') }}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity mb-4"
            style={{ background: 'var(--surface)', color: 'var(--near-black)', minHeight: '48px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Wochenplan ansehen
          </button>

          {/* Picnic Block */}
          {picnicUnique.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#f0fae8' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#5ba832', color: '#ffffff', fontSize: '10px' }}
                >
                  Picnic
                </span>
                <span className="text-xs font-semibold" style={{ color: '#5ba832' }}>
                  {picnicUnique.length} Artikel
                </span>
              </div>
              <PicnicListe items={daten.picnic} />
            </div>
          )}

          {/* Bring Einkauf 1 Block */}
          {bring1.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}
                >
                  Bring · Einkauf 1
                </span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>
                  {bring1.length} Artikel
                </span>
              </div>
              <ItemListe items={bring1} />
            </div>
          )}

          {/* Bring Einkauf 2 Block */}
          {bring2.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}
                >
                  Bring · Einkauf 2
                </span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>
                  {bring2.length} Artikel
                </span>
              </div>
              <ItemListe items={bring2} />
            </div>
          )}

          {/* Aus dem Vorrat Block */}
          {ausVorrat.length > 0 && (
            <div className="rounded-xl p-3 mb-5" style={{ background: '#f5f5f5' }}>
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#888888', color: '#ffffff', fontSize: '10px' }}
                >
                  Aus dem Vorrat
                </span>
                <span className="text-xs font-semibold" style={{ color: '#888888' }}>
                  {ausVorrat.length} Artikel
                </span>
              </div>
              <ItemListe items={ausVorrat} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
