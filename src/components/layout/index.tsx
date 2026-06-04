import React from 'react'
import { C, IconButton, Logo } from '../ui'
import { useStore } from '../../lib/store'
import { STEP_LABELS, TOTAL_STEPS } from '../../lib/constants'
import type { AppView } from '../../types'

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  title: string
  subtitle?: string
  icon?: string
  accent?: string
  onBack?: () => void
  actions?: React.ReactNode
}
export function TopBar({ title, subtitle, icon, accent = C.teal, onBack, actions }: TopBarProps) {
  return (
    <header
      role="banner"
      style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        boxShadow: '0 1px 2px rgba(14, 23, 38, 0.03)',
        display: 'flex', alignItems: 'center', padding: '11px 16px', gap: 11,
      }}
    >
      {onBack && (
        <IconButton icon="ti-arrow-left" label="Regresar" onClick={onBack} />
      )}
      {icon && !onBack && (
        <span
          aria-hidden
          style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 18%, transparent), color-mix(in srgb, ${accent} 6%, transparent))`,
            border: `1px solid color-mix(in srgb, ${accent} 24%, transparent)`,
            color: accent,
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 19 }} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fd" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: C.text, lineHeight: 1.15 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.2, marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
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
  { id: 'ajustes',    icon: 'ti-settings',         label: 'Ajustes' },
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
      className="bottom-nav nav-float"
      aria-label="Navegación principal"
      style={{
        position: 'fixed', bottom: 0,
        background: C.surface,
        display: 'flex', alignItems: 'center',
        zIndex: 10,
      }}
    >
      {visibleItems.map(item => {
        const active = view === item.id

        if (item.fab) {
          return (
            <button
              key={item.id}
              aria-label={item.label}
              onClick={() => handleNav(item.id)}
              style={{
                flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: C.gradBrand, color: '#fff', margin: '0 4px',
                boxShadow: C.shadowBrand,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 24 }} aria-hidden />
            </button>
          )
        }

        return (
          <button
            key={item.id}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => handleNav(item.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
              border: 'none', cursor: 'pointer', padding: '7px 0',
              background: active ? C.tealLight : 'transparent',
              color: active ? C.teal : C.muted,
              transition: 'background 0.14s, color 0.14s',
            }}
          >
            <i className={`ti ${item.icon}`} style={{ fontSize: 21 }} aria-hidden />
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500, letterSpacing: '0.1px' }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ─── Sidebar (tablet / desktop) ────────────────────────────────────────────────
// Persistent left rail shown ≥900px (hidden on phones, where BottomNav takes over).
// Reuses the same NAV_ITEMS + store state so navigation stays in sync across both.

export function SideNav() {
  const { view, setView, surveys, openWizard, userRole, user, theme, toggleTheme } = useStore()
  const isInvestigador = userRole === 'investigador'

  const items = NAV_ITEMS.filter(item => item.id !== 'nueva')

  return (
    <aside className="app-sidebar" aria-label="Navegación principal">
      {/* Brand header */}
      <div style={{
        padding: '20px 18px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <Logo size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.4px', color: C.text, lineHeight: 1.1 }}>MEDD</div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.2 }}>Medicamentos no utilizados</div>
        </div>
      </div>

      {/* Primary CTA (encuestadores collect data) */}
      {!isInvestigador && (
        <div style={{ padding: '14px 14px 6px' }}>
          <button
            onClick={() => openWizard(surveys.length)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
              boxShadow: C.shadowBrand,
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 18 }} aria-hidden />
            Nueva encuesta
          </button>
        </div>
      )}

      {/* Nav items */}
      <nav style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map(item => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              aria-current={active ? 'page' : undefined}
              onClick={() => setView(item.id as AppView)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: active ? C.tealLight : 'transparent',
                color: active ? C.teal : C.muted,
                fontSize: 14, fontWeight: active ? 600 : 500, textAlign: 'left',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 20, flexShrink: 0 }} aria-hidden />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer: theme toggle + session */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2,
            color: C.muted, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: 17 }} aria-hidden />
          {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        </button>
        {user?.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px', minWidth: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: C.tealLight, color: C.teal,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
            }}>
              {user.email[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{isInvestigador ? 'Investigador' : 'Encuestador'}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
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
      style={{
        padding: '14px 16px 12px', background: C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* Numbered stepper with check-marks for completed steps (goal-gradient) */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {STEP_LABELS.map((s, i) => {
          const done = i < stepIdx
          const current = i === stepIdx
          return (
            <React.Fragment key={s.n}>
              <div
                title={s.label}
                aria-current={current ? 'step' : undefined}
                style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: done ? C.primary : current ? C.tealLight : C.surface2,
                  color: done ? '#fff' : current ? C.teal : C.muted,
                  border: current ? `2px solid ${C.teal}` : `1px solid ${C.border}`,
                  transition: 'all 0.2s',
                }}
              >
                {done ? <i className="ti ti-check" style={{ fontSize: 15 }} aria-hidden /> : s.n}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div style={{
                  flex: 1, height: 2, margin: '0 4px',
                  background: i < stepIdx ? C.primary : C.border,
                  transition: 'background 0.25s',
                }} />
              )}
            </React.Fragment>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 9 }}>
        <span className="fd" style={{ fontSize: 14.5, color: C.text, fontWeight: 600, letterSpacing: '-0.01em' }}>{label}</span>
        <span style={{ fontSize: 12, color: C.muted }}>
          Paso {currentStep} de {TOTAL_STEPS}
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
