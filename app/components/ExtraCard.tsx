'use client'

import type { ExtrasWochenplanEintrag } from '@/types'

interface ExtraCardProps {
  extra: ExtrasWochenplanEintrag
  onRezept?: () => void
}

export function ExtraCard({ extra, onRezept }: ExtraCardProps) {
  const istSaft = extra.typ === 'saft'
  const icon = istSaft ? '🥤' : '🍏'
  const label = istSaft ? 'Saftvorschlag' : 'Gesundheitssnack'

  return (
    <div
      className="rounded-2xl px-3 pt-3 pb-2.5 flex flex-col"
      style={{ background: '#f0fdf4', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="flex-1">
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-secondary)' }}>
          {label}
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--near-black)' }}>
            {extra.name}
          </p>
          <span className="text-base flex-shrink-0">{icon}</span>
        </div>
        {extra.ist_neu && (
          <span
            className="inline-block text-xs font-semibold mt-1 px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--rausch)', color: '#fff', fontSize: '10px' }}
          >
            ✦ Neu
          </span>
        )}
      </div>
      {onRezept ? (
        <button
          onClick={onRezept}
          className="text-xs mt-1.5 font-medium text-left active:opacity-70"
          style={{ color: '#16a34a' }}
        >
          Rezept ansehen →
        </button>
      ) : (
        <p className="text-xs mt-1.5 font-medium" style={{ color: '#16a34a' }}>
          Rezept ansehen →
        </p>
      )}
    </div>
  )
}
