'use client'

import { GerichtCard } from '@/components/GerichtCard'
import type { Wochenplan, Gericht } from '@/types'

const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const
const TAG_LABEL: Record<string, string> = {
  montag: 'Montag', dienstag: 'Dienstag', mittwoch: 'Mittwoch',
  donnerstag: 'Donnerstag', freitag: 'Freitag', samstag: 'Samstag', sonntag: 'Sonntag'
}
const TAG_SHORT: Record<string, string> = {
  montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi',
  donnerstag: 'Do', freitag: 'Fr', samstag: 'Sa', sonntag: 'So'
}
const WOCHENENDE = new Set(['samstag', 'sonntag'])

function heutigerTag(): string {
  const tage = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
  return tage[new Date().getDay()]
}

interface WochenplanGridProps {
  plan: Wochenplan
  gerichte: Gericht[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onGenehmigen: () => void
}

export function WochenplanGrid({ plan, gerichte, onTauschen, onGenehmigen }: WochenplanGridProps) {
  const gerichtMap = Object.fromEntries(gerichte.map(g => [g.id, g]))
  const heute = heutigerTag()

  return (
    <div className="space-y-4">
      {/* Horizontal scroll — one card per day */}
      <div
        className="flex gap-3 overflow-x-auto scroll-hide snap-x-mandatory pb-2"
        style={{ paddingLeft: '16px', paddingRight: '16px' }}
      >
        {TAGE.map(tag => {
          const fruehstueck = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'frühstück')
          const mittag = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'mittag')
          const abend = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'abend')
          const istWochenende = WOCHENENDE.has(tag)
          const istHeute = tag === heute

          return (
            <div
              key={tag}
              className="snap-start shrink-0 flex flex-col gap-2"
              style={{ width: 'calc(85vw - 32px)', maxWidth: '320px' }}
            >
              {/* Day header */}
              <div className="flex items-center gap-2 px-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: istHeute ? 'var(--rausch)' : 'var(--surface)',
                    color: istHeute ? '#ffffff' : 'var(--near-black)',
                  }}
                >
                  {TAG_SHORT[tag]}
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--near-black)' }}>
                  {TAG_LABEL[tag]}
                </span>
                {istHeute && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: '#fff0f3', color: 'var(--rausch)' }}>
                    Heute
                  </span>
                )}
              </div>

              {/* Frühstück */}
              {istWochenende && fruehstueck ? (
                <GerichtCard
                  gerichtName={fruehstueck.gericht_name}
                  mahlzeit="frühstück"
                  gesund={gerichtMap[fruehstueck.gericht_id]?.gesund}
                  onTauschen={() => onTauschen(tag, 'frühstück')}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>
                    🍞 Frühstück
                  </p>
                  <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>
                    Toast mit Aufschnitt
                  </p>
                </div>
              )}

              {/* Mittag */}
              {mittag ? (
                <GerichtCard
                  gerichtName={mittag.gericht_name}
                  mahlzeit="mittag"
                  gesund={gerichtMap[mittag.gericht_id]?.gesund}
                  onTauschen={() => onTauschen(tag, 'mittag')}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>☀️ Mittag</p>
                  <p className="text-sm" style={{ color: 'var(--gray-disabled)' }}>—</p>
                </div>
              )}

              {/* Abend */}
              {abend ? (
                <GerichtCard
                  gerichtName={abend.gericht_name}
                  mahlzeit="abend"
                  gesund={gerichtMap[abend.gericht_id]?.gesund}
                  onTauschen={() => onTauschen(tag, 'abend')}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>🌙 Abend</p>
                  <p className="text-sm" style={{ color: 'var(--gray-disabled)' }}>—</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Genehmigen */}
      {plan.status === 'entwurf' && (
        <div className="px-4">
          <button
            onClick={onGenehmigen}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: 'var(--near-black)', color: '#ffffff' }}
          >
            Plan genehmigen ✓
          </button>
        </div>
      )}
    </div>
  )
}
