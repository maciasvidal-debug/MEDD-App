import React from 'react'
import { C, IconButton } from '../ui'
import { useStore } from '../../lib/store'
import { STEP_LABELS, TOTAL_STEPS } from '../../lib/constants'
import type { AppView } from '../../types'

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  title: string
  onBack?: () => void
  actions?: React.ReactNode
}
export function TopBar({ title, onBack, actions }: TopBarProps) {
  return (
    <header
      role="banner"
      style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: C.surface, borderBottom: `0.5px solid ${C.border}`,
        display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 10,
      }}
    >
      {onBack && (
        <IconButton icon="ti-arrow-left" label="Regresar" onClick={onBack} />
      )}
      <span style={{ fontSize: 16, fontWeight: 500, flex: 1, color: C.text }}>
        {title}
      </span>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </header>
  )
}

// ─── Bottom navigation ────────────────────────────────────────────────────────

interface NavItem {
  id: AppView | 'nueva'
  icon: string
  label: string
  fab?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  icon: 'ti-layout-dashboard', label: 'Panel' },
  { id: 'encuestas',  icon: 'ti-list',             label: 'Registros' },
  { id: 'nueva',      icon: 'ti-plus',             label: 'Nueva', fab: true },
  { id: 'buscar',     icon: 'ti-search',           label: 'CUM' },
  { id: 'exportar',   icon: 'ti-download',         label: 'Exportar' },
]

export function BottomNav() {
  const { view, setView, surveys, openWizard, userRole } = useStore()
  const isInvestigador = userRole === 'investigador'

  function handleNav(id: NavItem['id']) {
    if (id === 'nueva') openWizard(surveys.length)
    else setView(id as AppView)
  }

  // Investigators don't collect surveys — hide the FAB
  const visibleItems = isInvestigador
    ? NAV_ITEMS.filter(item => item.id !== 'nueva')
    : NAV_ITEMS

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 520,
        background: C.surface,
        borderTop: `0.5px solid ${C.border}`,
        display: 'flex', alignItems: 'center',
        padding: '6px 0 calc(6px + env(safe-area-inset-bottom))',
        zIndex: 10,
      }}
    >
      {visibleItems.map(item => {
        const active = view === item.id
        return (
          <button
            key={item.id}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => handleNav(item.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
              border: 'none', background: 'transparent',
              cursor: 'pointer', padding: '4px 0',
              color: active ? C.teal : C.muted,
            }}
          >
            {item.fab ? (
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                background: C.teal, display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: -2, marginTop: -12,
                boxShadow: '0 2px 8px rgba(15,118,110,0.30)',
              }}>
                <i className="ti ti-plus" style={{ fontSize: 22, color: '#fff' }} aria-hidden />
              </div>
            ) : (
              <i className={`ti ${item.icon}`} style={{ fontSize: 22 }} aria-hidden />
            )}
            <span style={{ fontSize: 11, fontWeight: active ? 500 : 400 }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ─── Step progress bar ────────────────────────────────────────────────────────

interface StepBarProps { currentStep: number }
export function StepBar({ currentStep }: StepBarProps) {
  const stepIdx = currentStep - 1
  const label = STEP_LABELS[stepIdx]?.label ?? ''

  return (
    <div
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-label={`Paso ${currentStep} de ${TOTAL_STEPS}: ${label}`}
      style={{ padding: '12px 16px 0' }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {STEP_LABELS.map((s, i) => (
          <div
            key={s.n}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background:
                i < stepIdx ? C.teal :
                i === stepIdx ? C.tealMid : '#E2E8F0',
              transition: 'background 0.25s',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
        <span style={{ fontSize: 12, color: C.teal, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.muted }}>
          {currentStep} / {TOTAL_STEPS}
        </span>
      </div>
    </div>
  )
}

// ─── Toast system ─────────────────────────────────────────────────────────────

const TOAST_COLORS = {
  success: { bg: '#166534', icon: 'ti-circle-check' },
  error:   { bg: '#B91C1C', icon: 'ti-alert-circle' },
  info:    { bg: '#1E3A5F', icon: 'ti-info-circle' },
}

export function ToastContainer() {
  const { toasts, removeToast } = useStore()
  if (!toasts.length) return null

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed', top: 14, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => {
        const { bg, icon } = TOAST_COLORS[t.level]
        return (
          <div
            key={t.id}
            role="status"
            className="slide-up"
            style={{
              background: bg, color: '#fff',
              padding: t.action ? '9px 10px 9px 16px' : '9px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
              whiteSpace: 'nowrap', pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: t.action ? 'default' : 'pointer',
            }}
            onClick={t.action ? undefined : () => removeToast(t.id)}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 15 }} aria-hidden />
            {t.message}
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); removeToast(t.id) }}
                style={{
                  marginLeft: 4, minHeight: 32, padding: '4px 12px', borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.5)', background: 'transparent',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
