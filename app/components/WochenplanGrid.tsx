'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { GerichtCard } from '@/components/GerichtCard'
import { GerichtPickerSheet } from '@/components/GerichtPickerSheet'
import { getLetztenFreitag, getMontag } from '@/lib/datum-utils'
import type { Wochenplan, Gericht, Mahlzeit } from '@/types'

const TAG_LABEL: Record<string, string> = {
  montag: 'Montag', dienstag: 'Dienstag', mittwoch: 'Mittwoch',
  donnerstag: 'Donnerstag', freitag: 'Freitag', samstag: 'Samstag', sonntag: 'Sonntag',
}
const TAG_SHORT: Record<string, string> = {
  montag: 'Mo', dienstag: 'Di', mittwoch: 'Mi',
  donnerstag: 'Do', freitag: 'Fr', samstag: 'Sa', sonntag: 'So',
}

interface TagSlot {
  tag: string
  datum: Date
  istCarryOver: boolean
}

function berechneSlots(): TagSlot[] {
  const JS_TAGE = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
  const tagVonDatum = (d: Date) => JS_TAGE[d.getDay()]

  const letzterFreitag = getLetztenFreitag()
  const carryOverMontag = getMontag(letzterFreitag)

  const slots: TagSlot[] = []

  // Carry-over: Freitag(+4), Samstag(+5), Sonntag(+6) der alten Woche
  for (const offset of [4, 5, 6]) {
    const datum = new Date(carryOverMontag)
    datum.setDate(carryOverMontag.getDate() + offset)
    slots.push({ tag: tagVonDatum(datum), datum, istCarryOver: true })
  }

  // Aktiv: Montag(+0) bis Sonntag(+6) der neuen Woche
  const aktiverMontag = new Date(carryOverMontag)
  aktiverMontag.setDate(carryOverMontag.getDate() + 7)
  for (let offset = 0; offset < 7; offset++) {
    const datum = new Date(aktiverMontag)
    datum.setDate(aktiverMontag.getDate() + offset)
    slots.push({ tag: tagVonDatum(datum), datum, istCarryOver: false })
  }

  return slots
}

function istHeuteDatum(datum: Date): boolean {
  return datum.toDateString() === new Date().toDateString()
}

function heutigesDatum(): string {
  return new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

function StaticCard({ label, name }: { label: string; name: string }) {
  return (
    <div className="rounded-2xl px-3 pt-3 pb-2.5 flex flex-col" style={{ background: '#fffbf0', boxShadow: 'var(--card-shadow)' }}>
      <div className="flex-1">
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-secondary)' }}>{label}</p>
        <p className="font-semibold text-sm" style={{ color: 'var(--near-black)' }}>{name}</p>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: 'transparent' }}>—</p>
      </div>
    </div>
  )
}

function CarryOverCard({ label, name }: { label: string; name: string }) {
  return (
    <div className="rounded-2xl px-3 pt-3 pb-2.5 flex flex-col" style={{ background: '#f5f5f5', boxShadow: 'var(--card-shadow)' }}>
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--gray-secondary)' }}>{label}</p>
      <p className="font-semibold text-sm" style={{ color: 'var(--near-black)', opacity: 0.7 }}>{name || '—'}</p>
    </div>
  )
}

interface AktionSlot { tag: string; mahlzeit: Mahlzeit; gerichtId?: string }

interface WochenplanGridProps {
  carryOverPlan: Wochenplan | null
  aktiverPlan: Wochenplan | null
  gerichte: Gericht[]
  onTauschen: (tag: string, mahlzeit: string) => void
  onWaehlen: (tag: string, mahlzeit: string, gericht: Gericht) => void
  onGenehmigen: () => void
  onRezept: (gericht: Gericht) => void
}

export function WochenplanGrid({ carryOverPlan, aktiverPlan, gerichte, onTauschen, onWaehlen, onGenehmigen, onRezept }: WochenplanGridProps) {
  const gerichtMap = useMemo(
    () => Object.fromEntries(gerichte.map(g => [g.id, g])),
    [gerichte]
  )

  const slots = useMemo(() => berechneSlots(), [])
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

  useEffect(() => {
    scrollZuHeute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        {slots.map((slot, idx) => {
          const istHeute = istHeuteDatum(slot.datum)
          const eintraege = slot.istCarryOver
            ? (carryOverPlan?.eintraege ?? [])
            : (aktiverPlan?.eintraege ?? [])

          const fruehstueck = eintraege.find(e => e.tag === slot.tag && e.mahlzeit === 'frühstück')
          const mittag = eintraege.find(e => e.tag === slot.tag && e.mahlzeit === 'mittag')
          const abend = eintraege.find(e => e.tag === slot.tag && e.mahlzeit === 'abend')

          return (
            <div
              key={slot.datum.toISOString().slice(0, 10)}
              ref={istHeute ? heuteRef : null}
              className="shrink-0 flex flex-col gap-2 px-4"
              style={{
                width: '100vw',
                scrollSnapAlign: 'start',
                opacity: slot.istCarryOver ? 0.75 : 1,
              }}
            >
              {/* Tag-Header */}
              <div className="flex items-center gap-2 px-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: istHeute ? 'var(--rausch)' : slot.istCarryOver ? 'transparent' : 'var(--surface)',
                    border: slot.istCarryOver && !istHeute ? '1.5px solid var(--border)' : 'none',
                    color: istHeute ? '#ffffff' : 'var(--near-black)',
                  }}
                >
                  {TAG_SHORT[slot.tag]}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--near-black)' }}>
                    {TAG_LABEL[slot.tag]}
                  </p>
                  {istHeute && (
                    <p className="text-xs leading-tight" style={{ color: 'var(--rausch)' }}>
                      {heutigesDatum()}
                    </p>
                  )}
                  {slot.istCarryOver && !istHeute && (
                    <p className="text-xs leading-tight" style={{ color: 'var(--gray-secondary)' }}>
                      letzte Woche
                    </p>
                  )}
                </div>
              </div>

              {/* Carry-over Slots: read-only */}
              {slot.istCarryOver ? (
                <>
                  <CarryOverCard label="Frühstück" name={fruehstueck?.gericht_name ?? '—'} />
                  <CarryOverCard label="Mittag" name={mittag?.gericht_name ?? '—'} />
                  <CarryOverCard label="Abend" name={abend?.gericht_name ?? '—'} />
                </>
              ) : (
                <>
                  {/* Frühstück */}
                  {fruehstueck ? (
                    <GerichtCard
                      gerichtName={fruehstueck.gericht_name}
                      mahlzeit="frühstück"
                      gesund={gerichtMap[fruehstueck.gericht_id]?.gesund}
                      hatRezept={!!gerichtMap[fruehstueck.gericht_id]?.rezept}
                      tauschOffen={aktiverSlot?.tag === slot.tag && aktiverSlot?.mahlzeit === 'frühstück'}
                      onTauschen={() => toggleSlot(slot.tag, 'frühstück', fruehstueck.gericht_id)}
                      onTauschenZufaellig={() => { onTauschen(slot.tag, 'frühstück'); setAktiverSlot(null) }}
                      onTauschenWaehlen={() => { setPicker({ tag: slot.tag, mahlzeit: 'frühstück', gerichtId: fruehstueck.gericht_id }); setAktiverSlot(null) }}
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
                      tauschOffen={aktiverSlot?.tag === slot.tag && aktiverSlot?.mahlzeit === 'mittag'}
                      onTauschen={() => toggleSlot(slot.tag, 'mittag', mittag.gericht_id)}
                      onTauschenZufaellig={() => { onTauschen(slot.tag, 'mittag'); setAktiverSlot(null) }}
                      onTauschenWaehlen={() => { setPicker({ tag: slot.tag, mahlzeit: 'mittag', gerichtId: mittag.gericht_id }); setAktiverSlot(null) }}
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
                      tauschOffen={aktiverSlot?.tag === slot.tag && aktiverSlot?.mahlzeit === 'abend'}
                      onTauschen={() => toggleSlot(slot.tag, 'abend', abend.gericht_id)}
                      onTauschenZufaellig={() => { onTauschen(slot.tag, 'abend'); setAktiverSlot(null) }}
                      onTauschenWaehlen={() => { setPicker({ tag: slot.tag, mahlzeit: 'abend', gerichtId: abend.gericht_id }); setAktiverSlot(null) }}
                      onRezept={() => { const g = gerichtMap[abend.gericht_id]; if (g) onRezept(g) }}
                    />
                  ) : (
                    <StaticCard label="Abend" name="—" />
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {aktiverPlan?.status === 'entwurf' && (
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
