'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { GerichtCard } from '@/components/GerichtCard'
import { GerichtPickerSheet } from '@/components/GerichtPickerSheet'
import type { Wochenplan, Gericht, Mahlzeit } from '@/types'

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

function StaticCard({ label, name }: { label: string; name: string }) {
  return (
    <div className="rounded-2xl px-3 pt-3 pb-2.5 flex flex-col" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
      <div className="flex-1">
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-secondary)' }}>{label}</p>
        <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{name}</p>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: 'transparent' }}>Rezept ansehen →</p>
        <p className="text-xs" style={{ color: 'transparent' }}>✓ gesund</p>
      </div>
    </div>
  )
}

function heutigerTag(): string {
  const tage = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
  return tage[new Date().getDay()]
}

function heutigesDatum(): string {
  return new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

interface AktionSlot { tag: string; mahlzeit: Mahlzeit; gerichtId?: string }

interface WochenplanGridProps {
  plan: Wochenplan
  gerichte: Gericht[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onWaehlen: (tag: string, mahlzeit: string, gericht: Gericht) => void
  onGenehmigen: () => void
  onRezept: (gericht: Gericht) => void
}

export function WochenplanGrid({ plan, gerichte, onTauschen, onWaehlen, onGenehmigen, onRezept }: WochenplanGridProps) {
  const gerichtMap = useMemo(
    () => Object.fromEntries(gerichte.map(g => [g.id, g])),
    [gerichte]
  )
  const heute = heutigerTag()
  const scrollRef = useRef<HTMLDivElement>(null)
  const heuteRef = useRef<HTMLDivElement>(null)
  const autoScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [aktiverSlot, setAktiverSlot] = useState<AktionSlot | null>(null)
  const [picker, setPicker] = useState<AktionSlot | null>(null)

  const scrollZuHeute = () => {
    if (!heuteRef.current || !scrollRef.current) return
    scrollRef.current.scrollTo({
      left: heuteRef.current.offsetLeft,
      behavior: 'smooth',
    })
  }

  // Beim ersten Rendern zu heute scrollen
  useEffect(() => {
    scrollZuHeute()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Nach manuellem Scrollen: 10 Sekunden Inaktivität → zurück zu heute
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const starteRueckScrollTimer = () => {
      if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current)
      autoScrollTimer.current = setTimeout(scrollZuHeute, 10000)
    }
    container.addEventListener('scroll', starteRueckScrollTimer, { passive: true })
    return () => {
      container.removeEventListener('scroll', starteRueckScrollTimer)
      if (autoScrollTimer.current) clearTimeout(autoScrollTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleSlot(tag: string, mahlzeit: Mahlzeit, gerichtId?: string) {
    setAktiverSlot(prev =>
      prev?.tag === tag && prev?.mahlzeit === mahlzeit ? null : { tag, mahlzeit, gerichtId }
    )
  }

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scroll-hide pb-2"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          willChange: 'scroll-position',
        }}
      >
        {TAGE.map(tag => {
          const fruehstueck = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'frühstück')
          const mittag = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'mittag')
          const abend = plan.eintraege.find(e => e.tag === tag && e.mahlzeit === 'abend')
          const istHeute = tag === heute

          return (
            <div
              key={tag}
              ref={istHeute ? heuteRef : null}
              className="shrink-0 flex flex-col gap-2 px-4"
              style={{
                width: '100vw',
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
              {fruehstueck ? (
                <GerichtCard
                  gerichtName={fruehstueck.gericht_name}
                  mahlzeit="frühstück"
                  gesund={gerichtMap[fruehstueck.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[fruehstueck.gericht_id]?.rezept}
                  tauschOffen={aktiverSlot?.tag === tag && aktiverSlot?.mahlzeit === 'frühstück'}
                  onTauschen={() => toggleSlot(tag, 'frühstück', fruehstueck.gericht_id)}
                  onTauschenZufaellig={() => { onTauschen(tag, 'frühstück'); setAktiverSlot(null) }}
                  onTauschenWaehlen={() => { setPicker({ tag, mahlzeit: 'frühstück', gerichtId: fruehstueck.gericht_id }); setAktiverSlot(null) }}
                  onRezept={() => { const g = gerichtMap[fruehstueck.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <StaticCard label="Frühstück" name="Toast mit Aufschnitt" />
              )}

              {/* Mittag */}
              {mittag ? (
                <GerichtCard
                  gerichtName={mittag.gericht_name}
                  mahlzeit="mittag"
                  gesund={gerichtMap[mittag.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[mittag.gericht_id]?.rezept}
                  tauschOffen={aktiverSlot?.tag === tag && aktiverSlot?.mahlzeit === 'mittag'}
                  onTauschen={() => toggleSlot(tag, 'mittag', mittag.gericht_id)}
                  onTauschenZufaellig={() => { onTauschen(tag, 'mittag'); setAktiverSlot(null) }}
                  onTauschenWaehlen={() => { setPicker({ tag, mahlzeit: 'mittag', gerichtId: mittag.gericht_id }); setAktiverSlot(null) }}
                  onRezept={() => { const g = gerichtMap[mittag.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <StaticCard label="Mittag" name="—" />
              )}

              {/* Abend */}
              {abend ? (
                <GerichtCard
                  gerichtName={abend.gericht_name}
                  mahlzeit="abend"
                  gesund={gerichtMap[abend.gericht_id]?.gesund}
                  hatRezept={!!gerichtMap[abend.gericht_id]?.rezept}
                  tauschOffen={aktiverSlot?.tag === tag && aktiverSlot?.mahlzeit === 'abend'}
                  onTauschen={() => toggleSlot(tag, 'abend', abend.gericht_id)}
                  onTauschenZufaellig={() => { onTauschen(tag, 'abend'); setAktiverSlot(null) }}
                  onTauschenWaehlen={() => { setPicker({ tag, mahlzeit: 'abend', gerichtId: abend.gericht_id }); setAktiverSlot(null) }}
                  onRezept={() => { const g = gerichtMap[abend.gericht_id]; if (g) onRezept(g) }}
                />
              ) : (
                <StaticCard label="Abend" name="—" />
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

      {/* Gericht-Picker */}
      {picker && (
        <GerichtPickerSheet
          gerichte={gerichte}
          tag={picker.tag}
          mahlzeit={picker.mahlzeit as Mahlzeit}
          aktuelleGerichtId={picker.gerichtId}
          onWaehlen={(g) => onWaehlen(picker.tag, picker.mahlzeit, g)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
