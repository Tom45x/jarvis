'use client'

import type { ExtrasWochenplanEintrag } from '@/types'

interface ExtraCardProps {
  extra: ExtrasWochenplanEintrag
}

export function ExtraCard({ extra }: ExtraCardProps) {
  const istSaft = extra.typ === 'saft'
  const icon = istSaft ? '🥤' : '🥗'
  const label = istSaft ? 'Saftvorschlag' : 'Gesundheitssnack'
  const hintergrund = istSaft ? '#fffbeb' : '#f0fdf4'

  return (
    <div
      className="rounded-2xl px-3 pt-3 pb-2.5 flex flex-col"
      style={{ background: hintergrund, boxShadow: 'var(--card-shadow)' }}
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
            style={{ background: '#ff385c', color: '#fff', fontSize: '10px' }}
          >
            ✦ Neu
          </span>
        )}
      </div>
      {extra.begruendung && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--gray-secondary)' }}>
          {extra.begruendung}
        </p>
      )}
    </div>
  )
}
