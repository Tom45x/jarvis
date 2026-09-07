# Freitags-Button & Plan-Genehmigung — Design

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Der "Plan erstellen"-Button bekommt ein neues Design und ist nur freitags sichtbar. Der Genehmigen-Button wandert als grüner Pill in den Header. Der Einkaufslisten-Button ist gesperrt solange der Plan nicht genehmigt ist.

**Architecture:** Reine UI-Änderung in `app/wochenplan/page.tsx`. Keine API- oder Datenbankänderungen nötig.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, Tailwind CSS

---

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `app/wochenplan/page.tsx` | Action Bar, Header-Status, Genehmigen-Pill — alles in einer Datei |

---

## Verhalten nach Wochentag

| Wochentag | Action Bar |
|---|---|
| **Freitag, kein Plan** | ① Rot (voll): Bearbeiten-Icon + „Plan für nächste Woche erstellen" ② Grau/inaktiv: Warenkorb + „Einkaufslisten senden" |
| **Freitag, Entwurf** | Gleich wie oben — Einkauf weiterhin gesperrt |
| **Freitag, genehmigt** | ① Rot (voll): „Plan erstellen" ② Schwarz/aktiv: „Einkaufslisten senden" |
| **Samstag–Donnerstag** | Nur schwarzer Button (voll): „Einkaufslisten senden" |

Freitag-Check: `new Date().getDay() === 5`

---

## Header

Wenn `aktiverPlan?.status === 'entwurf'`:
- Status-Text rot: „Entwurf — nicht genehmigt"
- Rechts daneben grüner Pill-Button: `✓ Genehmigen` → ruft `genehmigen()` auf
- Nach Genehmigung: Status-Text grün „✓ Genehmigt", Pill-Button verschwindet

```tsx
<div className="flex items-center justify-between mt-0.5">
  <p className="text-sm" style={{ color: aktiverPlan?.status === 'entwurf' ? 'var(--rausch)' : aktiverPlan?.status === 'genehmigt' ? '#00a651' : 'var(--gray-secondary)' }}>
    {aktiverPlan
      ? aktiverPlan.status === 'genehmigt' ? '✓ Genehmigt' : 'Entwurf — nicht genehmigt'
      : carryOverPlan ? 'Nächste Woche noch nicht geplant' : 'Noch kein Plan für diese Woche'}
  </p>
  {aktiverPlan?.status === 'entwurf' && (
    <button
      onClick={genehmigen}
      className="flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5"
      style={{ background: '#00a651', color: '#ffffff' }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Genehmigen
    </button>
  )}
</div>
```

---

## Action Bar

```tsx
const istFreitag = new Date().getDay() === 5

// Bearbeiten-Icon SVG (für Plan-erstellen-Button)
const BearbeitenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

// Einkauf-Button ist aktiv wenn: plan genehmigt ODER kein aktiver Plan (nur carry-over)
const einkaufAktiv = aktiverPlan?.status === 'genehmigt' || (!aktiverPlan && carryOverPlan !== null)
```

**Freitag-Layout (gestapelt):**
```tsx
{istFreitag && (
  <button onClick={generieren} disabled={loading} className="w-full ...rot...">
    <BearbeitenIcon /> Plan für nächste Woche erstellen
  </button>
)}
```

**Einkauf-Button (immer sichtbar wenn Plan vorhanden oder Freitag):**
```tsx
<button
  onClick={einkaufslisteSenden}
  disabled={!einkaufAktiv || einkaufLoading}
  style={{ background: einkaufAktiv ? 'var(--near-black)' : 'var(--surface)', color: einkaufAktiv ? '#ffffff' : 'var(--gray-secondary)' }}
>
  <WagenIcon /> Einkaufslisten senden
</button>
```

---

## Entfernt

- Der bisherige „Plan genehmigen ✓"-Button innerhalb von `WochenplanGrid.tsx` (`aktiverPlan?.status === 'entwurf'`-Block am Ende) fällt weg
- Der kleine rote Refresh-Icon-Button in der Action Bar fällt weg

---

## Randfälle

| Situation | Verhalten |
|---|---|
| Sa–Do, kein Plan | Nur „Einkaufslisten senden" (inaktiv, da kein Plan) — oder Button ganz ausblenden wenn weder carry-over noch aktiver Plan |
| Fr, Plan neu generiert (überschreibt genehmigten) | Neuer Plan ist Entwurf → Einkauf wieder gesperrt, Genehmigen-Pill erscheint |
| Einkaufslisten-Daten bereits geladen | Bestehende Logik (Button wechselt zu „Einkaufsliste ansehen") bleibt unverändert |
