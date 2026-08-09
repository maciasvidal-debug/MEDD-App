import { C } from '../../components/ui'

// ─── Role-adaptive hero bands ───────────────────────────────────────────────

// Investigator: a brand-gradient summary band framing the dataset at a glance.
export function InvestigadorHero({ n, nVenc, vencTotal, filtersActive, totalSurveys }: {
  n: number; nVenc: number; vencTotal: number; filtersActive: boolean; totalSurveys: number
}) {
  return (
    <div style={{
      background: C.gradBrand, color: '#fff', borderRadius: 16,
      padding: '18px 20px', marginBottom: 16, boxShadow: C.shadowBrand,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.92 }}>
        <i className="ti ti-shield-check" style={{ fontSize: 16 }} aria-hidden />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.3px' }}>
          Vista de investigador · datos agregados
          {filtersActive && ` · ${n} de ${totalSurveys} (filtrado)`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <HeroStat value={n} label="Encuestas" />
        <HeroStat value={nVenc} label="Hogares con vencidos" />
        <HeroStat value={vencTotal} label="Unidades vencidas" />
      </div>
    </div>
  )
}

// Encuestador: a "field mode" band — the primary action front and centre.
export function EncuestadorHero({ n, pendingDraft, onNew, onResume, onView }: {
  n: number; pendingDraft: boolean; onNew: () => void; onResume: () => void; onView: () => void
}) {
  return (
    <div style={{
      background: C.gradBrand, color: '#fff', borderRadius: 16,
      padding: '20px', marginBottom: 16, boxShadow: C.shadowBrand,
    }}>
      <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 2 }}>Trabajo de campo</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span className="fd tnum" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{n}</span>
        <span style={{ fontSize: 14, opacity: 0.9 }}>encuesta{n !== 1 ? 's' : ''} registrada{n !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={pendingDraft ? onResume : onNew}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: '#fff', color: C.primary, border: 'none', borderRadius: 10,
            padding: '11px 18px', fontSize: 15, fontWeight: 700,
          }}
        >
          <i className={`ti ${pendingDraft ? 'ti-player-play' : 'ti-plus'}`} style={{ fontSize: 19 }} aria-hidden />
          {pendingDraft ? 'Continuar encuesta' : 'Nueva encuesta'}
        </button>
        <button
          onClick={onView}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            background: 'rgba(255,255,255,0.16)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10,
            padding: '11px 16px', fontSize: 14, fontWeight: 600,
          }}
        >
          <i className="ti ti-list" style={{ fontSize: 18 }} aria-hidden />
          Ver registros
        </button>
      </div>
    </div>
  )
}

export function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="fd tnum" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>{label}</div>
    </div>
  )
}
