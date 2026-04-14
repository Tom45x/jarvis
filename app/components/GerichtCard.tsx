'use client'

import type { Mahlzeit } from '@/types'

const MAHLZEIT_LABEL: Record<Mahlzeit, string> = {
  'frühstück': '🍞 Frühstück',
  'mittag': '☀️ Mittag',
  'abend': '🌙 Abend',
}

interface GerichtCardProps {
  gerichtName: string
  mahlzeit: Mahlzeit
  gesund?: boolean
  onTauschen?: () => void
}

export function GerichtCard({ gerichtName, mahlzeit, gesund, onTauschen }: GerichtCardProps) {
  return (
    <div className={`rounded-lg p-3 border ${gesund ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            {MAHLZEIT_LABEL[mahlzeit]}
          </p>
          <p className="font-medium text-gray-800 text-sm leading-tight">{gerichtName}</p>
          {gesund && <span className="text-xs text-green-600 mt-1 block">✓ gesund</span>}
        </div>
        {onTauschen && (
          <button
            onClick={onTauschen}
            className="text-xs text-blue-500 hover:text-blue-700 shrink-0 mt-1"
            aria-label={`${gerichtName} tauschen`}
          >
            Tauschen
          </button>
        )}
      </div>
    </div>
  )
}
