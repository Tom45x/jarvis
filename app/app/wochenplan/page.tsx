'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WochenplanGrid } from '@/components/WochenplanGrid'
import { RezeptSheet } from '@/components/RezeptSheet'
import { ExtrasRezeptSheet } from '@/components/ExtrasRezeptSheet'
import { EinkaufslisteSheet } from '@/components/EinkaufslisteSheet'
import { apiFetch } from '@/lib/api-fetch'
import { SONDERKATEGORIEN } from '@/lib/sonderkategorien'
import type {
  Wochenplan,
  Gericht,
  ExtrasWochenplanEintrag,
  Einkaufsliste,
  ListenDiff,
  SektionDiff,
  WochenplanEintrag,
} from '@/types'

function buildDiffToast(diff: ListenDiff): string | null {
  const parts: string[] = []
  for (const sektion of ['bring1', 'bring2', 'picnic'] as const) {
    const sektionDiff = diff[sektion] as SektionDiff | undefined
    if (!sektionDiff) continue
    const label = sektion === 'bring1' ? 'Bring-Einkauf 1' : sektion === 'bring2' ? 'Bring-Einkauf 2' : 'Picnic'
    const hinzuNames = sektionDiff.hinzu.map(i => ('picnicProdukt' in i ? i.picnicProdukt : i.name)).filter(Boolean)
    const wegNames = sektionDiff.weg.map(i => ('picnicProdukt' in i ? i.picnicProdukt : i.name)).filter(Boolean)
    const inner: string[] = []
    if (hinzuNames.length) inner.push('+' + hinzuNames.join(', '))
    if (wegNames.length) inner.push('−' + wegNames.join(', '))
    if (inner.length) parts.push(`${label} aktualisiert: ${inner.join(' ')}`)
  }
  return parts.length ? parts.join(' · ') : null
}

export default function WochenplanPage() {
  const router = useRouter()
  const [carryOverPlan, setCarryOverPlan] = useState<Wochenplan | null>(null)
  const [aktiverPlan, setAktiverPlan] = useState<Wochenplan | null>(null)
  const [gerichte, setGerichte] = useState<Gericht[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listenStatus, setListenStatus] = useState<Einkaufsliste | null>(null)
  const [listeWirdErstellt, setListeWirdErstellt] = useState(false)
  const [einkaufslisteOffen, setEinkaufslisteOffen] = useState(false)
  const [rezeptGericht, setRezeptGericht] = useState<Gericht | null>(null)
  const [extras, setExtras] = useState<ExtrasWochenplanEintrag[]>([])
  const [carryOverExtras, setCarryOverExtras] = useState<ExtrasWochenplanEintrag[]>([])
  const [rezeptExtra, setRezeptExtra] = useState<ExtrasWochenplanEintrag | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const extrasGenerierenLaeuft = useRef(false)
  const [bestellStatus, setBestellStatus] = useState<{
    status: 'offen' | 'bestellt' | 'keine_liste' | 'kein_plan'
    fehlende_produkte?: string[]
    gesendete_anzahl?: number
  } | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function ladeListenStatus(planId: string) {
    try {
      const res = await apiFetch(`/api/einkaufsliste?wochenplan_id=${planId}`)
      if (res.ok) setListenStatus(await res.json())
    } catch { /* ignore */ }
  }

  async function versucheSyncRetry(planId: string) {
    try {
      const res = await apiFetch('/api/einkaufsliste/sync-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wochenplan_id: planId }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.retried) {
        showToast('Einkaufsliste wieder synchron')
        await ladeListenStatus(planId)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    apiFetch('/api/gerichte').then(r => r.json()).then(setGerichte).catch(() => setError('Gerichte konnten nicht geladen werden'))
    apiFetch('/api/wochenplan')
      .then(r => r.ok ? r.json() : null)
      .then((data: { carryOverPlan: Wochenplan | null; aktiverPlan: Wochenplan | null } | null) => {
        if (!data) return
        setCarryOverPlan(data.carryOverPlan)
        setAktiverPlan(data.aktiverPlan)
        if (data.aktiverPlan?.id) {
          const planId = data.aktiverPlan.id
          ladeListenStatus(planId)
          versucheSyncRetry(planId)
          apiFetch(`/api/extras?wochenplan_id=${planId}`).then(r => r.ok ? r.json() : []).then(async (geladen: ExtrasWochenplanEintrag[]) => {
            if (geladen.length > 0) { setExtras(geladen); return }
            if (extrasGenerierenLaeuft.current) return
            extrasGenerierenLaeuft.current = true
            try {
              const gen = await apiFetch('/api/extras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wochenplan_id: planId }),
              })
              setExtras(gen.ok ? await gen.json() : [])
            } finally { extrasGenerierenLaeuft.current = false }
          }).catch(e => console.warn('Extras konnten nicht geladen werden', e))
          apiFetch('/api/picnic/bestellung-status').then(r => r.ok ? r.json() : null).then(d => { if (d) setBestellStatus(d) }).catch(() => {})
        }
        if (data.carryOverPlan?.id) {
          apiFetch(`/api/extras?wochenplan_id=${data.carryOverPlan.id}`).then(r => r.ok ? r.json() : []).then(setCarryOverExtras).catch(() => {})
        }
      })
      .catch(() => setError('Wochenplan konnte nicht geladen werden'))
  }, [])

  async function generieren() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/wochenplan/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Fehler beim Generieren')
      setAktiverPlan(data)
      if (data?.id) {
        ladeListenStatus(data.id)
        apiFetch(`/api/extras?wochenplan_id=${data.id}`).then(r => r.ok ? r.json() : []).then(setExtras).catch(() => {})
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally { setLoading(false) }
  }

  async function tauschOderWaehle(body: { eintraege: WochenplanEintrag[]; status: 'entwurf' | 'genehmigt' }, planId: string) {
    const res = await apiFetch('/api/wochenplan', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen')
    const data = await res.json()
    setAktiverPlan(data)
    if (data.einkaufslisten_diff) {
      const msg = buildDiffToast(data.einkaufslisten_diff as ListenDiff)
      if (msg) showToast(msg)
    }
    await ladeListenStatus(planId)
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
      ? aktiverPlan.eintraege.map(e => e.tag === tag && e.mahlzeit === mahlzeit ? { ...e, gericht_id: neu.id, gericht_name: neu.name } : e)
      : [...aktiverPlan.eintraege, { tag: tag as WochenplanEintrag['tag'], mahlzeit: mahlzeit as WochenplanEintrag['mahlzeit'], gericht_id: neu.id, gericht_name: neu.name }]
    try {
      await tauschOderWaehle({ eintraege, status: aktiverPlan.status }, aktiverPlan.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Tauschen fehlgeschlagen')
      return
    }
    if (aktuell?.gericht_id) {
      apiFetch(`/api/gerichte/${aktuell.gericht_id}/tauschen`, { method: 'PATCH' }).catch(() => {})
    }
  }

  async function waehlen(tag: string, mahlzeit: string, gericht: Gericht) {
    if (!aktiverPlan) return
    const slotExistiert = aktiverPlan.eintraege.some(e => e.tag === tag && e.mahlzeit === mahlzeit)
    const eintraege = slotExistiert
      ? aktiverPlan.eintraege.map(e => e.tag === tag && e.mahlzeit === mahlzeit ? { ...e, gericht_id: gericht.id, gericht_name: gericht.name } : e)
      : [...aktiverPlan.eintraege, { tag: tag as WochenplanEintrag['tag'], mahlzeit: mahlzeit as WochenplanEintrag['mahlzeit'], gericht_id: gericht.id, gericht_name: gericht.name }]
    try {
      await tauschOderWaehle({ eintraege, status: aktiverPlan.status }, aktiverPlan.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Auswahl fehlgeschlagen')
    }
  }

  async function genehmigen() {
    if (!aktiverPlan) return
    // Optimistic Update: Status sofort auf genehmigt setzen, Liste-Pending markieren
    const vorherigerPlan = aktiverPlan
    setAktiverPlan({ ...aktiverPlan, status: 'genehmigt' })
    setListeWirdErstellt(true)
    try {
      await tauschOderWaehle({ eintraege: aktiverPlan.eintraege, status: 'genehmigt' }, aktiverPlan.id)
      showToast('Einkaufsliste bereit')
    } catch (e: unknown) {
      // Rollback bei Fehler
      setAktiverPlan(vorherigerPlan)
      setError(e instanceof Error ? e.message : 'Genehmigen fehlgeschlagen')
    } finally {
      setListeWirdErstellt(false)
    }
  }

  const hatPlan = carryOverPlan !== null || aktiverPlan !== null
  const istFreitag = new Date().getDay() === 5
  const buttonStatusSuffix = (() => {
    if (listeWirdErstellt) return '· wird erstellt …'
    if (!listenStatus) return ''
    if (bestellStatus?.status === 'bestellt') {
      const fehlt = (bestellStatus.fehlende_produkte?.length ?? 0) > 0
      return fehlt ? '· Bestellt (teilweise)' : '· Bestellt'
    }
    if (listenStatus.gesendet_am) return '· Gesendet'
    return '· Entwurf'
  })()

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
          <p className="text-sm" style={{ color: aktiverPlan?.status === 'entwurf' ? 'var(--rausch)' : aktiverPlan?.status === 'genehmigt' ? '#00a651' : 'var(--gray-secondary)' }}>
            {aktiverPlan
              ? aktiverPlan.status === 'genehmigt' ? '✓ Genehmigt' : 'Entwurf — nicht genehmigt'
              : carryOverPlan ? 'Nächste Woche noch nicht geplant' : 'Noch kein Plan für diese Woche'}
          </p>
          {aktiverPlan?.status === 'entwurf' && (
            <button onClick={genehmigen} className="flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5 active:opacity-70 transition-opacity" style={{ background: '#00a651', color: '#ffffff' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Genehmigen
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm px-3 py-2 rounded-xl" style={{ background: '#fff0f3', color: 'var(--rausch)' }}>{error}</p>}
        {toast && (
          <div className="mt-3 px-3 py-2 rounded-lg text-sm flex items-center gap-2" style={{ background: '#f0fae8', color: '#2d6a1b', border: '1px solid #c8e6b2' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>{toast}</span>
          </div>
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
          onExtrasRezept={setRezeptExtra}
        />
      ) : (
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <div className="text-5xl mb-4">🍽️</div>
          <p className="text-lg font-semibold mb-2" style={{ color: 'var(--near-black)' }}>Noch kein Plan</p>
          <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
            {istFreitag ? 'Tippe unten auf "Plan erstellen"' : 'Am Freitag kann Jarvis einen neuen Plan erstellen'}
          </p>
        </div>
      )}

      <div className="fixed left-0 right-0 px-4 pb-2 pt-3 z-50" style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 34px))', background: 'linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0))' }}>
        <div className="flex flex-col gap-2">
          {istFreitag && (
            <button onClick={generieren} disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:opacity-70 transition-opacity" style={{ background: 'var(--rausch)', color: '#ffffff', minHeight: '52px' }}>
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

          {aktiverPlan?.status === 'genehmigt' && (
            <button
              onClick={() => setEinkaufslisteOffen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
              style={{ background: 'var(--near-black)', color: '#ffffff', minHeight: '52px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Einkaufsliste {buttonStatusSuffix}
            </button>
          )}
        </div>
      </div>

      {rezeptGericht?.rezept && (
        <RezeptSheet gericht={rezeptGericht as Gericht & { rezept: NonNullable<Gericht['rezept']> }} onClose={() => setRezeptGericht(null)} />
      )}
      {rezeptExtra && <ExtrasRezeptSheet extra={rezeptExtra} onClose={() => setRezeptExtra(null)} />}
      {einkaufslisteOffen && aktiverPlan && (
        <EinkaufslisteSheet
          wochenplanId={aktiverPlan.id}
          bestellStatus={bestellStatus}
          onClose={() => { setEinkaufslisteOffen(false); ladeListenStatus(aktiverPlan.id) }}
          onSent={() => { ladeListenStatus(aktiverPlan.id) }}
        />
      )}
    </main>
  )
}
