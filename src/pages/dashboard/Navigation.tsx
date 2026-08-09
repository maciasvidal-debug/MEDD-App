import React, { useEffect, useState } from 'react'
import { C, HelpTip, Card, Chip } from '../../components/ui'
import { OPT } from '../../lib/constants'


// ─── Cockpit filter bar (investigator) ──────────────────────────────────────

export function FilterBar({
  ciudadOptions, progOptions, fCiudad, setFCiudad, fSalud, setFSalud, fEstrato, setFEstrato,
  fProg, setFProg, fTipo, setFTipo, filtersActive, onClear, exportCount, onExport,
}: {
  ciudadOptions: string[]
  progOptions: string[]
  fCiudad: string; setFCiudad: (v: string) => void
  fSalud: string; setFSalud: (v: string) => void
  fEstrato: number | null; setFEstrato: (v: number | null) => void
  fProg: string; setFProg: (v: string) => void
  fTipo: string; setFTipo: (v: string) => void
  filtersActive: boolean; onClear: () => void
  exportCount: number; onExport: () => void
}) {
  return (
    <Card style={{ marginBottom: 16, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <i className="ti ti-adjustments-horizontal" style={{ fontSize: 15 }} aria-hidden /> Filtros
        </span>
        {filtersActive && (
          <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.teal, fontSize: 12, fontWeight: 600 }}>
            Limpiar
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {ciudadOptions.length > 0 && (
          <select value={fCiudad} onChange={e => setFCiudad(e.target.value)} aria-label="Filtrar por ciudad">
            <option value="">Todas las ciudades</option>
            {ciudadOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div>
          <div style={{ fontSize: 11, color: C.hint, marginBottom: 6 }}>Régimen de salud</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OPT.asSalud.map(o => (
              <Chip key={o} label={o} active={fSalud === o} onClick={() => setFSalud(fSalud === o ? '' : o)} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.hint, marginBottom: 6 }}>Estrato</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OPT.estrato.map(e => (
              <Chip key={e} label={String(e)} active={fEstrato === e} onClick={() => setFEstrato(fEstrato === e ? null : e)} />
            ))}
          </div>
        </div>

        {/* Surveyor profile — only shown once such data exists */}
        {progOptions.length > 0 && (
          <select value={fProg} onChange={e => setFProg(e.target.value)} aria-label="Filtrar por programa del encuestador">
            <option value="">Todos los programas (encuestador)</option>
            {progOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <div>
          <div style={{ fontSize: 11, color: C.hint, marginBottom: 6 }}>Institución del encuestador</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OPT.etrTipoInst.map(t => (
              <Chip key={t} label={t} active={fTipo === t} onClick={() => setFTipo(fTipo === t ? '' : t)} />
            ))}
          </div>
        </div>
      </div>

      {/* Export the current (filtered) subset straight from the cockpit */}
      <button
        onClick={onExport}
        disabled={exportCount === 0}
        style={{
          marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, cursor: exportCount === 0 ? 'not-allowed' : 'pointer',
          border: `1px solid ${C.border}`, background: C.surface2, color: C.text,
          fontSize: 13, fontWeight: 600, opacity: exportCount === 0 ? 0.5 : 1,
        }}
      >
        <i className="ti ti-file-download" style={{ fontSize: 17 }} aria-hidden />
        Exportar {filtersActive ? 'selección' : 'todo'} (CSV · {exportCount})
      </button>
    </Card>
  )
}

// ─── Section wayfinding (investigator's long analytical scroll) ─────────────
// The panel stacks ~18 analytical cards in one column; without a map the
// investigator has to hunt by scrolling. A sticky "jump to" chip row gives an
// at-a-glance table of contents and one-tap navigation to each block.
//
// Deliberately its OWN component with its OWN state: the parent DashboardPage is
// tuned (useShallow) so the heavy Recharts tree bails out of unrelated
// re-renders. Scroll-spy state lives HERE, a sibling of the charts — so tracking
// the active section on scroll never re-renders them.

// Zero-height anchor placed before each section group; scrollMarginTop clears the
// sticky TopBar + section nav so a jumped-to heading isn't hidden beneath them.
export function SectionAnchor({ id }: { id: string }) {
  return <div id={id} style={{ scrollMarginTop: 116 }} aria-hidden />
}

export type NavSection = { id: string; label: string; icon: string }
export function DashboardSectionNav({ sections }: { sections: NavSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const ids = sections.map(s => s.id).join(',')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const els = ids.split(',').map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    // A band across the middle of the viewport decides the "current" section:
    // the topmost anchor inside it wins, so the active chip tracks what the
    // investigator is actually reading.
    const obs = window.IntersectionObserver ? new window.IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    ) : null
    els.forEach(el => obs && obs.observe(el))
    return () => { if(obs) obs.disconnect() }
  }, [ids])

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }

  return (
    <nav
      aria-label="Secciones del panel"
      style={{
        position: 'sticky', top: 58, zIndex: 9,
        display: 'flex', gap: 6, overflowX: 'auto', padding: '9px 16px',
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        boxShadow: '0 4px 10px -8px rgba(14, 23, 38, 0.25)',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}
    >
      {sections.map(s => {
        const on = active === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            aria-current={on ? 'true' : undefined}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 12.5, fontWeight: on ? 600 : 500,
              border: on ? `1px solid ${C.teal}` : `1px solid ${C.border}`,
              background: on ? C.tealLight : C.surface,
              color: on ? C.teal : C.muted,
              transition: 'background 0.14s, color 0.14s, border-color 0.14s',
            }}
          >
            <i className={`ti ${s.icon}`} style={{ fontSize: 15 }} aria-hidden />
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}

export function SectionLabel({ children, help }: { children: React.ReactNode; help?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, background: C.teal, flexShrink: 0 }} aria-hidden />
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '-0.005em' }}>
        {children}
      </span>
      {help && <HelpTip text={help} label={typeof children === 'string' ? children : undefined} />}
    </div>
  )
}
