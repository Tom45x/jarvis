'use client'

import { GerichtCard } from '@/components/GerichtCard'
import type { Wochenplan, Gericht } from '@/types'

const TAGE = ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'] as const
const TAG_LABEL: Record<string, string> = {
  montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi',
  donnerstag: 'Do', freitag: 'Fr', samstag: 'Sa', sonntag: 'So'
}

interface WochenplanGridProps {
  plan: Wochenplan
  gerichte: Gericht[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onGenehmigen: () => void
}

export function WochenplanGrid({ plan, gerichte, onTauschen, onGenehmigen }: WochenplanGridProps) {
  const gerichtMap = Object.fromEntries(gerichte.map(g => [g.id, g]))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {TAGE.map(tag => {
          const mittag = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'mittag')
          const abend = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'abend')

          return (
            <div key={tag} className="space-y-2">
              <p className="text-center text-xs font-semibold text-gray-500 uppercase">
                {TAG_LABEL[tag]}
              </p>
              {mittag && (
                <GerichtCard
                  gerichtName={mittag.gericht_name}
                  mahlzeit="mittag"
                  gesund={gerichtMap[mittag.gericht_id]?.gesund}
                  onTauschen={() => onTauschen(tag, 'mittag')}
                />
              )}
              {abend && (
                <GerichtCard
                  gerichtName={abend.gericht_name}
                  mahlzeit="abend"
                  gesund={gerichtMap[abend.gericht_id]?.gesund}
                  onTauschen={() => onTauschen(tag, 'abend')}
                />
              )}
            </div>
          )
        })}
      </div>

      {plan.status === 'entwurf' && (
        <button
          onClick={onGenehmigen}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
        >
          Plan genehmigen ✓
        </button>
      )}
    </div>
  )
}
