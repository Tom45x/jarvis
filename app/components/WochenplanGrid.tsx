'use client'

import { useEffect, useMemo, useRef } from 'react'
import { GerichtCard } from '@/components/GerichtCard'
import type { Wochenplan, Gericht, DrinkVorschlag } from '@/types'

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

function heutigesDatum(): string {
  return new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

interface WochenplanGridProps {
  plan: Wochenplan
  gerichte: Gericht[]
  drinks?: DrinkVorschlag[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onGenehmigen: () => void
  onRezept: (gericht: Gericht) => void
}

export function WochenplanGrid({ plan, gerichte, drinks = [], onTauschen, onGenehmigen, onRezept }: WochenplanGridProps) {
  const gerichtMap = useMemo(
    () => Object.fromEntries(gerichte.map(g => [g.id, g])),
    [gerichte]
  )
  const heute = heutigerTag()
  const scrollRef = useRef<HTMLDivElement>(null)
  const heuteRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const autoScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const doScroll = () => {
      if (!heuteRef.current || !scrollRef.current) return
      const container = scrollRef.current
      const card = heuteRef.current
      container.scrollTo({
        left: card.offsetLeft - (container.offsetWidth - card.offsetWidth) / 2,
        behavior: 'smooth',
      })
    }

    if (isFirstRender.current) {
      isFirstRender.current = false
      doScroll()
      return
    }

    if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current)
    autoScrollTimer.current = setTimeout(doScroll, 3000)
    return () => {
      if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current)
    }
  }, [plan])

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-hide pb-2"
        style={{
          paddingLeft: '16px',
          paddingRight: '16px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
        }}
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
              ref={istHeute ? heuteRef : null}
              className="shrink-0 flex flex-col gap-2"
              style={{
                width: 'calc(85vw - 32px)',
                maxWidth: '320px',
                scrollSnapAlign: 'start',
              }}
            >
              <div className="flex items-center gap-2 px-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: istHeute ? 'var(--rausch)' : 'var(--surface)',
                    color: istHeute ? '#ffffff' : 'var(--near-black)',
                  }}
                >
                  {TAG_SHORT[tag]}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--near-black)' }}>
                    {TAG_LABEL[tag]}
                  </p>
                  {istHeute && (
                    <p className="text-xs leading-tight" style={{ color: 'var(--rausch)' }}>
                      {heutigesDatum()}
                    </p>
                  )}
                </div>
              </div>

              {/* Frühstück */}
              {istWochenende && fruehstueck ? (
                <GerichtCard
                  gerichtName={fruehstueck.gericht_name}
                  mahlzeit="frühstück"
                  gesund={gerichtMap[fruehstueck.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[fruehstueck.gericht_id]?.rezept}
                  onTauschen={() => onTauschen(tag, 'frühstück')}
                  onRezept={() => { const g = gerichtMap[fruehstueck.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>Frühstück</p>
                  <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>Toast mit Aufschnitt</p>
                </div>
              )}

              {/* Mittag */}
              {mittag ? (
                <GerichtCard
                  gerichtName={mittag.gericht_name}
                  mahlzeit="mittag"
                  gesund={gerichtMap[mittag.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[mittag.gericht_id]?.rezept}
                  onTauschen={() => onTauschen(tag, 'mittag')}
                  onRezept={() => { const g = gerichtMap[mittag.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>Mittag</p>
                  <p className="text-sm" style={{ color: 'var(--gray-disabled)' }}>—</p>
                </div>
              )}

              {/* Abend */}
              {abend ? (
                <GerichtCard
                  gerichtName={abend.gericht_name}
                  mahlzeit="abend"
                  gesund={gerichtMap[abend.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[abend.gericht_id]?.rezept}
                  onTauschen={() => onTauschen(tag, 'abend')}
                  onRezept={() => { const g = gerichtMap[abend.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <div className="rounded-2xl p-4" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--gray-secondary)' }}>Abend</p>
                  <p className="text-sm" style={{ color: 'var(--gray-disabled)' }}>—</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {plan.status === 'entwurf' && (
        <div className="px-4">
          <button
            onClick={onGenehmigen}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-opacity active:opacity-70"
            style={{ background: 'var(--near-black)', color: '#ffffff', minHeight: '52px' }}
          >
            Plan genehmigen ✓
          </button>
        </div>
      )}

      {drinks.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--near-black)', paddingLeft: '16px' }}>
            Saft-Vorschläge
          </p>
          <div
            className="flex gap-3 overflow-x-auto scroll-hide pb-2"
            style={{ paddingLeft: '16px', paddingRight: '16px', scrollSnapType: 'x mandatory' }}
          >
            {drinks.map((drink, i) => (
              <div
                key={i}
                className="shrink-0 rounded-2xl p-4"
                style={{ width: 'calc(85vw - 32px)', maxWidth: '320px', scrollSnapAlign: 'start', background: '#fff8f0', boxShadow: 'var(--card-shadow)' }}
              >
                <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{drink.name}</p>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--gray-secondary)' }}>
                  {drink.zutaten.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
