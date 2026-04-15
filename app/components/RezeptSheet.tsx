'use client'

import { useEffect, useRef, useState } from 'react'
import type { Gericht } from '@/types'

interface RezeptSheetProps {
  gericht: Gericht & { rezept: NonNullable<Gericht['rezept']> }
  onClose: () => void
}

export function RezeptSheet({ gericht, onClose }: RezeptSheetProps) {
  const [visible, setVisible] = useState(false)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => setVisible(true))
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 80) {
      touchStartY.current = null
      onClose()
    }
  }

  function handleTouchEnd() {
    touchStartY.current = null
  }

  return (
    <>
      {/* Hintergrund-Overlay */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Sheet-Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rezept-title"
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
        style={{
          background: '#ffffff',
          maxHeight: '80vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Drag-Handle — Touch-Events nur hier */}
        <div
          className="flex justify-center pt-3 pb-1"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Scrollbarer Inhalt */}
        <div className="overflow-y-auto px-5 pb-10" style={{ maxHeight: 'calc(80vh - 40px)' }}>
          {/* Titel */}
          <h2
            id="rezept-title"
            className="text-lg font-bold mt-2 mb-5"
            style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}
          >
            {gericht.name}
          </h2>

          {/* Zutaten */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--near-black)' }}>
              Zutaten (4 Personen)
            </h3>
            <ul className="space-y-1.5">
              {gericht.rezept.zutaten.map((z, i) => (
                <li key={`zutat-${i}`} className="flex items-start gap-2 text-sm" style={{ color: 'var(--near-black)' }}>
                  <span style={{ color: 'var(--rausch)', flexShrink: 0 }}>·</span>
                  {z}
                </li>
              ))}
            </ul>
          </div>

          {/* Zubereitung */}
          <div>
            <h3 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--near-black)' }}>
              Zubereitung
            </h3>
            <ol className="space-y-3">
              {gericht.rezept.zubereitung.map((schritt, i) => (
                <li key={`schritt-${i}`} className="flex items-start gap-3">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--rausch)', color: '#ffffff' }}
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
        </div>
      </div>
    </>
  )
}
