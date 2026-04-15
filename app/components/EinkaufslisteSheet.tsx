'use client'

import { useEffect, useRef, useState } from 'react'
import type { EinkaufsItem } from '@/types'
import { aggregiere } from '@/lib/einkaufsliste'

export interface EinkaufslistenDaten {
  picnic: EinkaufsItem[]
  bring1: EinkaufsItem[]
  bring2: EinkaufsItem[]
}

interface EinkaufslisteSheetProps {
  daten: EinkaufslistenDaten
  onClose: () => void
}

function PicnicLogo() {
  return (
    <span
      className="inline-flex items-center justify-center text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: '#5ba832', color: '#ffffff', fontSize: '10px' }}
    >
      Picnic
    </span>
  )
}

function BringLogo() {
  return (
    <span
      className="inline-flex items-center justify-center text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
      style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}
    >
      Bring
    </span>
  )
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

export function EinkaufslisteSheet({ daten, onClose }: EinkaufslisteSheetProps) {
  const picnic = aggregiere(daten.picnic)
  const bring1 = aggregiere(daten.bring1)
  const bring2 = aggregiere(daten.bring2)
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

        <div className="overflow-y-auto px-5 pb-10" style={{ maxHeight: 'calc(80vh - 40px)' }}>
          <h2
            id="einkauf-title"
            className="text-lg font-bold mt-2 mb-5"
            style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}
          >
            Einkaufsliste
          </h2>

          {/* Picnic */}
          {picnic.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <PicnicLogo />
                <span className="text-sm font-semibold" style={{ color: 'var(--near-black)' }}>
                  {picnic.length} Artikel
                </span>
              </div>
              <ItemListe items={picnic} />
            </div>
          )}

          {/* Bring — Einkauf 1 */}
          {bring1.length > 0 && (
            <div className="mb-5" style={{ borderTop: picnic.length > 0 ? '1px solid var(--border)' : undefined, paddingTop: picnic.length > 0 ? '16px' : undefined }}>
              <div className="flex items-center gap-2 mb-2.5">
                <BringLogo />
                <span className="text-sm font-semibold" style={{ color: 'var(--near-black)' }}>
                  Einkauf 1 — {bring1.length} Artikel
                </span>
              </div>
              <ItemListe items={bring1} />
            </div>
          )}

          {/* Bring — Einkauf 2 */}
          {bring2.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <BringLogo />
                <span className="text-sm font-semibold" style={{ color: 'var(--near-black)' }}>
                  Einkauf 2 — {bring2.length} Artikel
                </span>
              </div>
              <ItemListe items={bring2} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
