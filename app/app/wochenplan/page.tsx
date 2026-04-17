'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WochenplanGrid } from '@/components/WochenplanGrid'
import { RezeptSheet } from '@/components/RezeptSheet'
import { EinkaufslisteSheet, type EinkaufslistenDaten } from '@/components/EinkaufslisteSheet'
import { apiFetch } from '@/lib/api-fetch'
import { SONDERKATEGORIEN } from '@/lib/sonderkategorien'
import type { Wochenplan, Gericht, ExtrasWochenplanEintrag } from '@/types'

export default function WochenplanPage() {
  const router = useRouter()
  const [carryOverPlan, setCarryOverPlan] = useState<Wochenplan | null>(null)
  const [aktiverPlan, setAktiverPlan] = useState<Wochenplan | null>(null)
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [einkaufLoading, setEinkaufLoading] = useState(false)
  const [einkaufMeldung, setEinkaufMeldungRaw] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('einkaufMeldung') ?? null
  })

  function setEinkaufMeldung(meldung: string | null) {
    setEinkaufMeldungRaw(meldung)
    if (meldung) sessionStorage.setItem('einkaufMeldung', meldung)
    else sessionStorage.removeItem('einkaufMeldung')
  }
  const [einkaufslisteDaten, setEinkaufslisteDatenRaw] = useState<EinkaufslistenDaten | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = sessionStorage.getItem('einkaufslisteDaten')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [einkaufslisteOffen, setEinkaufslisteOffen] = useState(false)

  function setEinkaufslisteDaten(daten: EinkaufslistenDaten | null) {
    setEinkaufslisteDatenRaw(daten)
    if (daten) sessionStorage.setItem('einkaufslisteDaten', JSON.stringify(daten))
    else sessionStorage.removeItem('einkaufslisteDaten')
  }
  const [rezeptGericht, setRezeptGericht] = useState<Gericht | null>(null)
  const [extras, setExtras] = useState<ExtrasWochenplanEintrag[]>([])
  const [carryOverExtras, setCarryOverExtras] = useState<ExtrasWochenplanEintrag[]>([])

  useEffect(() => {
    apiFetch('/api/gerichte')
      .then(r => r.json())
      .then(setGerichte)
      .catch(() => setError('Gerichte konnten nicht geladen werden'))
    apiFetch('/api/wochenplan')
      .then(r => r.ok ? r.json() : null)
      .then((data: { carryOverPlan: Wochenplan | null; aktiverPlan: Wochenplan | null } | null) => {
        if (data) {
          setCarryOverPlan(data.carryOverPlan)
          setAktiverPlan(data.aktiverPlan)
          if (data.aktiverPlan?.id) {
            apiFetch(`/api/extras?wochenplan_id=${data.aktiverPlan.id}`)
              .then(r => r.ok ? r.json() : [])
              .then(setExtras)
              .catch(() => {})
          }
          if (data.carryOverPlan?.id) {
            apiFetch(`/api/extras?wochenplan_id=${data.carryOverPlan.id}`)
              .then(r => r.ok ? r.json() : [])
              .then(setCarryOverExtras)
              .catch(() => {})
          }
        }
      })
      .catch(() => setError('Wochenplan konnte nicht geladen werden'))
  }, [])

  async function generieren() {
    setLoading(true)
    setError(null)
    setEinkaufslisteDaten(null)
    try {
      const res = await apiFetch('/api/wochenplan/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Fehler beim Generieren')
      setAktiverPlan(data)
      if (data?.id) {
        apiFetch(`/api/extras?wochenplan_id=${data.id}`)
          .then(r => r.ok ? r.json() : [])
          .then(setExtras)
          .catch(() => {})
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function tauschen(tag: string, mahlzeit: string) {
    if (!aktiverPlan) return
    const aktuell = aktiverPlan.eintraege.find(e => e.tag === tag && e.mahlzeit === mahlzeit)

    const sonderKategorie = mahlzeit === 'frühstück'
      ? 'frühstück'
      : SONDERKATEGORIEN[`${tag}-${mahlzeit}`] ?? null

    const andere = gerichte.filter(g =>
      g.id !== aktuell?.gericht_id &&
      !g.gesperrt &&
      (sonderKategorie
        ? g.kategorie === sonderKategorie
        : g.kategorie !== 'frühstück' && g.kategorie !== 'trainingstage' && g.kategorie !== 'filmabend')
    )
    const neu = andere[Math.floor(Math.random() * andere.length)]
    if (!neu) return

    const slotExistiert = aktiverPlan.eintraege.some(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const eintraege = slotExistiert
      ? aktiverPlan.eintraege.map(e =>
          e.tag === tag && e.mahlzeit === mahlzeit
            ? { ...e, gericht_id: neu.id, gericht_name: neu.name }
            : e
        )
      : [...aktiverPlan.eintraege, { tag, mahlzeit, gericht_id: neu.id, gericht_name: neu.name }]

    const res = await apiFetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege, status: aktiverPlan.status })
    })
    setAktiverPlan(await res.json())
    setEinkaufslisteDaten(null)
    setEinkaufMeldung(null)

    if (aktuell?.gericht_id) {
      try {
        await apiFetch(`/api/gerichte/${aktuell.gericht_id}/tauschen`, { method: 'PATCH' })
      } catch {
        console.warn('Tausch-Counter konnte nicht aktualisiert werden:', aktuell.gericht_id)
      }
    }
  }

  async function waehlen(tag: string, mahlzeit: string, gericht: Gericht) {
    if (!aktiverPlan) return
    const slotExistiert = aktiverPlan.eintraege.some(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const eintraege = slotExistiert
      ? aktiverPlan.eintraege.map(e =>
          e.tag === tag && e.mahlzeit === mahlzeit
            ? { ...e, gericht_id: gericht.id, gericht_name: gericht.name }
            : e
        )
      : [...aktiverPlan.eintraege, { tag, mahlzeit, gericht_id: gericht.id, gericht_name: gericht.name }]

    const res = await apiFetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege, status: aktiverPlan.status })
    })
    setAktiverPlan(await res.json())
    setEinkaufslisteDaten(null)
    setEinkaufMeldung(null)
  }

  async function genehmigen() {
    if (!aktiverPlan) return
    const res = await apiFetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege: aktiverPlan.eintraege, status: 'genehmigt' })
    })
    setAktiverPlan(await res.json())
  }

  async function einkaufslisteSenden() {
    setEinkaufLoading(true)
    setEinkaufMeldung(null)
    try {
      const res = await apiFetch('/api/einkaufsliste/senden', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler')
      if (data.listen) setEinkaufslisteDaten(data.listen)
      const picnicArtikel = data.picnic1Count ?? 0
      const picnicInfo = picnicArtikel > 0 ? ` · Picnic: ${picnicArtikel} Artikel` : ''
      setEinkaufMeldung(
        `✅ Bring: ${(data.einkauf1Count ?? 0) + (data.einkauf2Count ?? 0)} Artikel${picnicInfo}`
      )
    } catch (e: unknown) {
      setEinkaufMeldung(`❌ ${e instanceof Error ? e.message : 'Fehler'}`)
    } finally {
      setEinkaufLoading(false)
    }
  }

  const hatPlan = carryOverPlan !== null || aktiverPlan !== null
  const istFreitag = new Date().getDay() === 5
  const einkaufAktiv = aktiverPlan?.status === 'genehmigt'

  return (
    <main className="min-h-screen bg-white pb-32">
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--near-black)', letterSpacing: '-0.44px' }}>
            Diese Woche
          </h1>
          <button
            onClick={() => router.push('/wochenplan/uebersicht')}
            aria-label="Wochenplan Gesamtansicht"
            className="w-10 h-10 rounded-full flex items-center justify-center active:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--near-black)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm" style={{
            color: aktiverPlan?.status === 'entwurf'
              ? 'var(--rausch)'
              : aktiverPlan?.status === 'genehmigt'
              ? '#00a651'
              : 'var(--gray-secondary)'
          }}>
            {aktiverPlan
              ? aktiverPlan.status === 'genehmigt' ? '✓ Genehmigt' : 'Entwurf — nicht genehmigt'
              : carryOverPlan ? 'Nächste Woche noch nicht geplant' : 'Noch kein Plan für diese Woche'}
          </p>
          {aktiverPlan?.status === 'entwurf' && (
            <button
              onClick={genehmigen}
              className="flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5 active:opacity-70 transition-opacity"
              style={{ background: '#00a651', color: '#ffffff' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Genehmigen
            </button>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#fff0f3', color: 'var(--rausch)' }}>
            {error}
          </p>
        )}
      </div>

      {hatPlan ? (
        <WochenplanGrid
          carryOverPlan={carryOverPlan}
          aktiverPlan={aktiverPlan}
          gerichte={gerichte}
          extras={extras}
          carryOverExtras={carryOverExtras}
          onTauschen={tauschen}
          onWaehlen={waehlen}
          onRezept={setRezeptGericht}
        />
      ) : (
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--near-black)' }}>
            Noch kein Plan
          </p>
          <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
            {istFreitag ? 'Tippe unten auf "Plan erstellen"' : 'Am Freitag kann Jarvis einen neuen Plan erstellen'}
          </p>
        </div>
      )}

      {/* Thumb-Zone Action Bar */}
      <div
        className="fixed left-0 right-0 px-4 pb-2 pt-3 z-50"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 34px))',
          background: 'linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0))',
        }}
      >
        <div className="flex flex-col gap-2">
          {istFreitag && (
            <button
              onClick={generieren}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
              style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '52px' }}
            >
              {loading ? (
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Plan für nächste Woche erstellen
                </>
              )}
            </button>
          )}

          {(hatPlan || istFreitag) && (
            einkaufslisteDaten ? (
              <button
                onClick={() => setEinkaufslisteOffen(true)}
                className="w-full flex flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
                style={{ background: 'var(--near-black)', color: '#ffffff', minHeight: '52px' }}
              >
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                  Einkaufsliste ansehen
                </div>
                {einkaufMeldung && (
                  <span className="text-xs font-normal opacity-70">{einkaufMeldung.replace(/^✅\s*/, '')}</span>
                )}
              </button>
            ) : (
              <button
                onClick={einkaufslisteSenden}
                disabled={!einkaufAktiv || einkaufLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity"
                style={{
                  background: einkaufAktiv ? 'var(--near-black)' : 'var(--surface)',
                  color: einkaufAktiv ? '#ffffff' : 'var(--gray-secondary)',
                  minHeight: '52px',
                }}
              >
                {einkaufLoading ? 'Sende...' : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    Einkaufslisten senden
                  </>
                )}
              </button>
            )
          )}
        </div>
      </div>

      {rezeptGericht?.rezept && (
        <RezeptSheet
          gericht={rezeptGericht as Gericht & { rezept: NonNullable<Gericht['rezept']> }}
          onClose={() => setRezeptGericht(null)}
        />
      )}
      {einkaufslisteOffen && einkaufslisteDaten && (
        <EinkaufslisteSheet
          daten={einkaufslisteDaten}
          onClose={() => setEinkaufslisteOffen(false)}
        />
      )}
    </main>
  )
}
