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
  onTauschen?: () => void
  onRezept?: () => void
}

export function GerichtCard({ gerichtName, mahlzeit, gesund, hatRezept, onTauschen, onRezept }: GerichtCardProps) {
  const { label } = MAHLZEIT_CONFIG[mahlzeit]

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>
            {label}
          </p>
          <p className="font-semibold text-sm leading-snug truncate" style={{ color: 'var(--near-black)' }}>
            {gerichtName}
          </p>
          {gesund && (
            <span className="text-xs mt-1 inline-block" style={{ color: '#3d9970' }}>
              ✓ gesund
            </span>
          )}
        </div>
        {onTauschen && (
          <button
            onClick={onTauschen}
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)' }}
            aria-label={`${gerichtName} tauschen`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--near-black)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        )}
      </div>

      {/* Rezept-Link — nur wenn Rezept vorhanden */}
      {hatRezept && onRezept && (
        <button
          onClick={onRezept}
          className="mt-2 pt-2 w-full text-left text-xs font-medium active:opacity-70 transition-opacity"
          style={{
            borderTop: '1px solid var(--surface)',
            color: 'var(--rausch)',
          }}
        >
          Rezept ansehen →
        </button>
      )}
    </div>
  )
}
