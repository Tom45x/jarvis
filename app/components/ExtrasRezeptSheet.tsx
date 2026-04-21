'use client'

import { useEffect, useRef, useState } from 'react'
import type { ExtrasWochenplanEintrag } from '@/types'

interface ExtrasRezeptSheetProps {
  extra: ExtrasWochenplanEintrag
  onClose: () => void
}

function zubereitungZuSchritte(zubereitung: string): string[] {
  const zeilen = zubereitung.split(/\n/).map(z => z.trim()).filter(Boolean)
  if (zeilen.length > 1) return zeilen
  return zubereitung.split(/(?<=[.!?])\s+/).filter(Boolean)
}

export function ExtrasRezeptSheet({ extra, onClose }: ExtrasRezeptSheetProps) {
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

  const schritte = extra.zubereitung ? zubereitungZuSchritte(extra.zubereitung) : []
  const istSaft = extra.typ === 'saft'

  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="extras-rezept-title"
        className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-3xl overflow-hidden"
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
          <div className="flex items-center gap-2 mt-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              {istSaft ? 'Saftvorschlag' : 'Gesundheitssnack'}
            </span>
          </div>
          <h2
            id="extras-rezept-title"
            className="text-lg font-bold mb-5"
            style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}
          >
            {extra.name}
          </h2>

          {(extra.katalog_zutaten?.length ?? 0) > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--near-black)' }}>
                Zutaten
              </h3>
              <ul className="space-y-1.5">
                {extra.katalog_zutaten!.map((z, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--near-black)' }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}>·</span>
                    {z.menge > 0 ? `${z.menge}${z.einheit} ${z.name}` : z.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {schritte.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--near-black)' }}>
                Zubereitung
              </h3>
              <ol className="space-y-3">
                {schritte.map((schritt, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: '#16a34a', color: '#ffffff' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed pt-0.5" style={{ color: 'var(--near-black)' }}>
                      {schritt.replace(/^Schritt \d+:\s*/i, '')}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {extra.begruendung && extra.begruendung !== 'DEV-Modus' && (
            <p className="text-xs mt-5 italic" style={{ color: 'var(--gray-secondary)' }}>
              {extra.begruendung}
            </p>
          )}
        </div>
      </div>
    </>
  )
}
