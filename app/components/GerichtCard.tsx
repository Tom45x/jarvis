'use client'

import type { Mahlzeit } from '@/types'

const MAHLZEIT_CONFIG: Record<Mahlzeit, { label: string; emoji: string }> = {
  'frühstück': { label: 'Frühstück', emoji: '🍞' },
  'mittag': { label: 'Mittag', emoji: '☀️' },
  'abend': { label: 'Abend', emoji: '🌙' },
}

interface GerichtCardProps {
  gerichtName: string
  mahlzeit: Mahlzeit
  gesund?: boolean
  onTauschen?: () => void
}

export function GerichtCard({ gerichtName, mahlzeit, gesund, onTauschen }: GerichtCardProps) {
  const { label, emoji } = MAHLZEIT_CONFIG[mahlzeit]

  return (
    <div
      className="bg-white rounded-2xl p-4"
      style={{ boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>
            {emoji} {label}
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
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
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
    </div>
  )
}
