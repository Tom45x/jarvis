'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { Einkaufsliste, EinkaufsItem, PicnicListenArtikel } from '@/types'

interface EinkaufslisteSheetProps {
  wochenplanId: string
  bestellStatus: {
    status: 'offen' | 'bestellt' | 'keine_liste' | 'kein_plan'
    fehlende_produkte?: string[]
    gesendete_anzahl?: number
  } | null
  onClose: () => void
  onSent: () => void
}

function statusText(liste: Einkaufsliste | null, bestellt: boolean): string {
  if (!liste) return 'Lädt …'
  if (liste.gesendet_am === null) return 'Entwurf — noch nicht gesendet'
  if (bestellt) return '✓ Bestellt'
  return `Gesendet am ${new Date(liste.gesendet_am).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
}

function ZeileBring({ item, gestrichen, onToggle, editable }: {
  item: EinkaufsItem
  gestrichen: boolean
  onToggle: () => void
  editable: boolean
}) {
  return (
    <li className="text-sm flex items-baseline gap-2 py-1" style={{ color: gestrichen ? 'var(--gray-secondary)' : 'var(--near-black)' }}>
      <span style={{ color: 'var(--rausch)', flexShrink: 0 }}>·</span>
      <span className={`flex-1 ${gestrichen ? 'line-through' : ''}`}>{item.name}</span>
      {item.menge > 0 && (
        <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>
          {item.menge} {item.einheit}
        </span>
      )}
      {editable && (
        <button
          onClick={onToggle}
          aria-label={gestrichen ? 'Wiederherstellen' : 'Streichen'}
          className="w-6 h-6 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: gestrichen ? 'var(--surface)' : 'transparent', color: 'var(--gray-secondary)' }}
        >
          {gestrichen ? '↶' : '×'}
        </button>
      )}
    </li>
  )
}

function ZeilePicnic({ item, gestrichen, bestellt, fehlt, onToggle, editable }: {
  item: PicnicListenArtikel
  gestrichen: boolean
  bestellt: boolean
  fehlt: boolean
  onToggle: () => void
  editable: boolean
}) {
  return (
    <li className="text-sm flex items-baseline gap-2 py-1" style={{ color: gestrichen ? 'var(--gray-secondary)' : 'var(--near-black)' }}>
      <span style={{ color: bestellt ? '#166534' : fehlt ? '#92400e' : '#5ba832', flexShrink: 0 }}>
        {bestellt ? '✓' : fehlt ? '⚠' : '·'}
      </span>
      <span className={`flex-1 ${gestrichen ? 'line-through' : ''}`}>{item.picnicProdukt}</span>
      {item.menge > 0 && (
        <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>
          {item.menge} {item.einheit}
        </span>
      )}
      {editable && (
        <button
          onClick={onToggle}
          aria-label={gestrichen ? 'Wiederherstellen' : 'Streichen'}
          className="w-6 h-6 rounded-full flex items-center justify-center active:opacity-70"
          style={{ background: gestrichen ? 'var(--surface)' : 'transparent', color: 'var(--gray-secondary)' }}
        >
          {gestrichen ? '↶' : '×'}
        </button>
      )}
    </li>
  )
}

export function EinkaufslisteSheet({ wochenplanId, bestellStatus, onClose, onSent }: EinkaufslisteSheetProps) {
  const [liste, setListe] = useState<Einkaufsliste | null>(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const touchStartY = useRef<number | null>(null)

  const laden = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/einkaufsliste?wochenplan_id=${wochenplanId}`)
      if (!res.ok) throw new Error('Konnte Liste nicht laden')
      setListe(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }, [wochenplanId])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => setVisible(true))
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    laden()
    return () => {
      document.removeEventListener('keydown', onKey)
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
    }
  }, [onClose, laden])

  const editable = liste !== null && liste.gesendet_am === null
  const bestellt = bestellStatus?.status === 'bestellt'
  const fehlendeSet = new Set(bestellStatus?.fehlende_produkte ?? [])

  async function toggleGestrichen(name: string) {
    if (!liste) return
    const aktuellGestrichen = liste.gestrichen.includes(name)
    setListe({
      ...liste,
      gestrichen: aktuellGestrichen
        ? liste.gestrichen.filter(n => n !== name)
        : [...liste.gestrichen, name],
    })
    try {
      await apiFetch('/api/einkaufsliste/streichen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wochenplan_id: wochenplanId,
          zutatName: name,
          streichen: !aktuellGestrichen,
        }),
      })
    } catch {
      laden()
    }
  }

  async function senden() {
    setSending(true)
    try {
      const res = await apiFetch('/api/einkaufsliste/senden', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Senden fehlgeschlagen')
      }
      await laden()
      onSent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setSending(false)
    }
  }

  function handleTouchStart(e: React.TouchEvent) { touchStartY.current = e.touches[0].clientY }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    if (e.touches[0].clientY - touchStartY.current > 80) { touchStartY.current = null; onClose() }
  }
  function handleTouchEnd() { touchStartY.current = null }

  const gestrichen = new Set(liste?.gestrichen ?? [])
  const anzahlGestrichen = gestrichen.size

  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="einkauf-title"
        className="fixed left-0 right-0 bottom-0 z-[60] rounded-t-3xl overflow-hidden"
        style={{
          background: '#ffffff',
          maxHeight: '85vh',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <div className="flex justify-center pt-3 pb-1" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(85vh - 40px)' }}>
          <div className="mt-2 mb-5">
            <h2 id="einkauf-title" className="text-lg font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.3px' }}>
              Einkaufsliste
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--gray-secondary)' }}>
              {statusText(liste, bestellt)}
            </p>
          </div>

          {loading && <p className="text-sm py-8 text-center" style={{ color: 'var(--gray-secondary)' }}>Lädt …</p>}
          {error && <p className="text-sm px-3 py-2 rounded-xl mb-3" style={{ background: '#fff0f3', color: 'var(--rausch)' }}>{error}</p>}

          {liste && liste.picnic.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#f0fae8' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#5ba832', color: '#ffffff', fontSize: '10px' }}>Picnic</span>
                <span className="text-xs font-semibold" style={{ color: '#5ba832' }}>{liste.picnic.length} Artikel</span>
              </div>
              {bestellt && (bestellStatus?.fehlende_produkte?.length ?? 0) > 0 && (
                <p className="text-xs mb-2 px-2 py-1 rounded" style={{ background: '#fffbeb', color: '#92400e' }}>
                  ⚠ {bestellStatus!.fehlende_produkte!.length} Artikel möglicherweise nicht dabei
                </p>
              )}
              <ul className="space-y-0.5">
                {liste.picnic.map((item, i) => (
                  <ZeilePicnic
                    key={i}
                    item={item}
                    gestrichen={gestrichen.has(item.picnicProdukt)}
                    bestellt={bestellt && !fehlendeSet.has(item.picnicProdukt)}
                    fehlt={bestellt && fehlendeSet.has(item.picnicProdukt)}
                    onToggle={() => toggleGestrichen(item.picnicProdukt)}
                    editable={editable}
                  />
                ))}
              </ul>
            </div>
          )}

          {liste && liste.bring1.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}>Bring · Einkauf 1</span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>{liste.bring1.length} Artikel</span>
              </div>
              <ul className="space-y-0.5">
                {liste.bring1.map((item, i) => (
                  <ZeileBring
                    key={i}
                    item={item}
                    gestrichen={gestrichen.has(item.name)}
                    onToggle={() => toggleGestrichen(item.name)}
                    editable={editable}
                  />
                ))}
              </ul>
            </div>
          )}

          {liste && liste.bring2.length > 0 && (
            <div className="rounded-xl p-3 mb-3" style={{ background: '#fff5ed' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f46a00', color: '#ffffff', fontSize: '10px' }}>Bring · Einkauf 2</span>
                <span className="text-xs font-semibold" style={{ color: '#f46a00' }}>{liste.bring2.length} Artikel</span>
              </div>
              <ul className="space-y-0.5">
                {liste.bring2.map((item, i) => (
                  <ZeileBring
                    key={i}
                    item={item}
                    gestrichen={gestrichen.has(item.name)}
                    onToggle={() => toggleGestrichen(item.name)}
                    editable={editable}
                  />
                ))}
              </ul>
            </div>
          )}

          {liste && liste.aus_vorrat.length > 0 && (
            <div className="rounded-xl p-3 mb-5" style={{ background: '#f5f5f5' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#888888', color: '#ffffff', fontSize: '10px' }}>Aus dem Vorrat</span>
                <span className="text-xs font-semibold" style={{ color: '#888888' }}>{liste.aus_vorrat.length} Artikel</span>
              </div>
              <ul className="space-y-0.5">
                {liste.aus_vorrat.map((item, i) => (
                  <li key={i} className="text-sm flex items-baseline gap-2 py-1" style={{ color: 'var(--near-black)' }}>
                    <span style={{ color: '#888888', flexShrink: 0 }}>·</span>
                    <span className="flex-1">{item.name}</span>
                    {item.menge > 0 && (
                      <span className="text-xs shrink-0" style={{ color: 'var(--gray-secondary)' }}>{item.menge} {item.einheit}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {editable && liste && (
            <div className="mt-4">
              {anzahlGestrichen > 0 && (
                <p className="text-xs mb-2 text-center" style={{ color: 'var(--gray-secondary)' }}>
                  {anzahlGestrichen} {anzahlGestrichen === 1 ? 'Zutat wird' : 'Zutaten werden'} nicht gesendet
                </p>
              )}
              <button
                onClick={senden}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
                style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '52px' }}
              >
                {sending ? 'Sende …' : 'An Picnic + Bring senden'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
