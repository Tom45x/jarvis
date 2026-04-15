'use client'

import type { Mahlzeit } from '@/types'

const MAHLZEIT_CONFIG: Record<Mahlzeit, { label: string }> = {
  'frühstück': { label: 'Frühstück' },
  'mittag': { label: 'Mittag' },
  'abend': { label: 'Abend' },
}

interface GerichtCardProps {
  gerichtName: string
  mahlzeit: Mahlzeit
  gesund?: boolean
  hatRezept?: boolean
  tauschOffen?: boolean
  onTauschen?: () => void
  onTauschenZufaellig?: () => void
  onTauschenWaehlen?: () => void
  onRezept?: () => void
}

export function GerichtCard({
  gerichtName, mahlzeit, gesund, hatRezept,
  tauschOffen, onTauschen, onTauschenZufaellig, onTauschenWaehlen, onRezept,
}: GerichtCardProps) {
  const { label } = MAHLZEIT_CONFIG[mahlzeit]
  const hatAktion = !!(hatRezept && onRezept)

  return (
    <div
      className="rounded-2xl px-3 pt-3 pb-2.5 flex flex-col"
      style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-secondary)' }}>
            {label}
          </p>
          <p className="font-semibold text-sm leading-snug truncate" style={{ color: 'var(--near-black)' }}>
            {gerichtName}
          </p>
        </div>
        {onTauschen && (
          <button
            onClick={tauschOffen ? onTauschenZufaellig : onTauschen}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
            style={{ background: tauschOffen ? 'var(--rausch)' : 'var(--surface)' }}
            aria-label={tauschOffen ? `${gerichtName} zufällig tauschen` : `${gerichtName} tauschen`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tauschOffen ? '#ffffff' : 'var(--near-black)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        )}
      </div>

      {/* Footer — normal oder Tausch-Optionen */}
      <div className="mt-1.5">
        {tauschOffen ? (
          <div className="flex gap-2">
            <button
              onClick={onTauschen}
              className="flex-1 py-1.5 rounded-xl text-xs font-medium active:opacity-70 transition-opacity"
              style={{ background: 'var(--surface)', color: 'var(--gray-secondary)' }}
            >
              Abbrechen
            </button>
            <button
              onClick={onTauschenWaehlen}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold active:opacity-70 transition-opacity"
              style={{ background: 'var(--near-black)', color: '#ffffff' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              Wählen
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={hatAktion ? onRezept : undefined}
              className="text-xs font-medium transition-opacity"
              style={{
                color: hatAktion ? 'var(--rausch)' : 'transparent',
                pointerEvents: hatAktion ? 'auto' : 'none',
              }}
              tabIndex={hatAktion ? 0 : -1}
              aria-hidden={!hatAktion}
            >
              Rezept ansehen →
            </button>
            <p className="text-xs" style={{ color: gesund ? '#3d9970' : 'transparent' }}>
              ✓ gesund
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
