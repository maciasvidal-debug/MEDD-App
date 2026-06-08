import React, { useState } from 'react'
import {
  Card, Button, Field, SectionHead, ConfirmDialog, ChipGroup, IconChip, C,
} from '../ui'
import { OPT } from '../../lib/constants'
import type { Settings } from '../../types'
import type { Theme, Density } from '../../lib/store'

// Sub-components of AjustesPage (src/pages/index.tsx). The settings page is a
// long form split into independent sections so each part — project config,
// surveyor profile, appearance, account, app info — reads and evolves on its
// own. The parent owns the draft form state and store wiring; these stay
// presentational and receive everything via props.

// Setter factory shared by the two form sections: `set('field')(value)`.
type SetField = (k: keyof Settings) => (v: string) => void

// Project-level configuration (name + surveyor id prefilled into new surveys).
export function ProjectConfigSection({ form, set }: { form: Settings; set: SetField }) {
  return (
    <>
      <SectionHead icon="ti-settings" label="Configuración del proyecto" />

      <Field label="Nombre del proyecto">
        <input
          value={form.nombreProyecto}
          onChange={e => set('nombreProyecto')(e.target.value)}
          placeholder="MEDD – Medicamentos No Utilizados"
        />
      </Field>

      <Field label="ID del encuestador" hint="Se prellena en cada nueva encuesta">
        <input
          type="number" min={1}
          value={form.nuiEncuestador}
          onChange={e => set('nuiEncuestador')(e.target.value)}
          placeholder="Ej: 1012345678"
        />
      </Field>
    </>
  )
}

// Surveyor profile stamped onto every captured survey, plus the optional
// backfill action for older surveys captured before the profile was complete.
export function SurveyorProfileSection({
  form, set, onSave, backfillCount, onBackfill,
}: {
  form:          Settings
  set:           SetField
  onSave:        () => void
  backfillCount: number
  onBackfill:    () => void
}) {
  return (
    <>
      <SectionHead icon="ti-user-shield" label="Perfil del encuestador" />
      <p style={{ fontSize: 12, color: C.hint, margin: '-8px 0 16px', lineHeight: 1.5 }}>
        Se registra una sola vez y se adjunta a cada encuesta que captures.
        Permite analizar los datos por perfil del encuestador (control de
        calidad y sesgo entre observadores).
      </p>

      <Field label="Programa académico">
        <select value={form.etrPrograma} onChange={e => set('etrPrograma')(e.target.value)}>
          <option value="">— Selecciona —</option>
          {OPT.etrPrograma.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </Field>

      <Field label="Tipo de institución">
        <ChipGroup options={OPT.etrTipoInst} value={form.etrTipoInst} onChange={set('etrTipoInst')} />
      </Field>

      <Field label="Semestre" hint="1 a 12">
        <input
          type="number" min={1} max={12}
          value={form.etrSemestre}
          onChange={e => set('etrSemestre')(e.target.value)}
          placeholder="Ej: 8"
        />
      </Field>

      <Field label="Institución educativa">
        <input
          value={form.etrInstitucion}
          onChange={e => set('etrInstitucion')(e.target.value)}
          placeholder="Ej: Universidad Nacional de Colombia"
        />
      </Field>

      <Button fullWidth onClick={onSave} icon="ti-device-floppy">
        Guardar ajustes
      </Button>

      {/* Retroactively stamp the completed profile onto older surveys that were
          captured before it was filled in (fills only blank fields). */}
      {backfillCount > 0 && (
        <Card style={{ marginTop: 10, background: C.tealLight, border: `0.5px solid ${C.teal}40` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-history-toggle" style={{ fontSize: 18, color: C.teal, flexShrink: 0 }} aria-hidden />
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, lineHeight: 1.45 }}>
              Tienes <strong>{backfillCount}</strong> encuesta(s) anteriores sin el perfil del
              encuestador. Puedes completarlas con tu perfil actual.
            </div>
          </div>
          <Button
            fullWidth size="sm" variant="secondary" icon="ti-wand"
            style={{ marginTop: 10 }}
            onClick={onBackfill}
          >
            Completar {backfillCount} encuesta(s) anterior(es)
          </Button>
        </Card>
      )}
    </>
  )
}

// Appearance controls: light/dark theme toggle and interface density, plus the
// shortcut to replay the onboarding welcome.
export function AppearanceSection({
  theme, toggleTheme, density, setDensity, onShowWelcome,
}: {
  theme:         Theme
  toggleTheme:   () => void
  density:       Density
  setDensity:    (d: Density) => void
  onShowWelcome: () => void
}) {
  return (
    <>
      <Card style={{ background: C.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <IconChip icon={theme === 'dark' ? 'ti-moon' : 'ti-sun'} accent={C.teal} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Tema {theme === 'dark' ? 'oscuro' : 'claro'}</div>
            <div style={{ fontSize: 12, color: C.muted }}>Ajusta la app a tu entorno de trabajo.</div>
          </div>
          <button
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Alternar tema oscuro"
            onClick={toggleTheme}
            style={{
              width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: theme === 'dark' ? C.primary : C.border, flexShrink: 0,
              position: 'relative', transition: 'background 0.18s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: theme === 'dark' ? 25 : 3,
              width: 24, height: 24, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.18s',
            }} />
          </button>
        </div>
      </Card>

      <Card style={{ background: C.surface, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <IconChip icon="ti-layout-distribute-vertical" accent={C.teal} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Densidad</div>
            <div style={{ fontSize: 12, color: C.muted }}>Espaciado de tarjetas y listas.</div>
          </div>
        </div>
        <div role="radiogroup" aria-label="Densidad de la interfaz" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {([
            { id: 'comfortable', label: 'Cómoda', icon: 'ti-baseline-density-medium' },
            { id: 'compact',     label: 'Compacta', icon: 'ti-baseline-density-small' },
          ] as const).map(o => {
            const active = density === o.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setDensity(o.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 0', borderRadius: 8, cursor: 'pointer',
                  border: active ? `1.5px solid ${C.teal}` : `1px solid ${C.border}`,
                  background: active ? C.tealLight : C.surface,
                  color: active ? C.teal : C.text,
                  fontSize: 14, fontWeight: active ? 600 : 400,
                }}
              >
                <i className={`ti ${o.icon}`} style={{ fontSize: 18 }} aria-hidden />
                {o.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Button
        fullWidth variant="ghost" icon="ti-help-circle"
        style={{ marginTop: 10 }}
        onClick={onShowWelcome}
      >
        Ver introducción de nuevo
      </Button>
    </>
  )
}

// Account section: session info, sync trigger and sign-out (with its own
// confirmation dialog, which warns when there are unsynced surveys at risk).
export function AccountSection({
  userEmail, isInvestigador, pendingCount, syncing, onSync, onSignOut,
}: {
  userEmail:      string
  isInvestigador: boolean
  pendingCount:   number
  syncing:        boolean
  onSync:         () => void
  onSignOut:      () => void
}) {
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  return (
    <>
      <Card style={{ background: C.bg }}>
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          <InfoRow label="Sesión activa" value={userEmail} />
          <InfoRow
            label="Rol"
            value={
              <span style={{
                background: isInvestigador ? '#EFF6FF' : '#F0FDF9',
                color:      isInvestigador ? '#1D4ED8' : '#0F766E',
                border:     `0.5px solid ${isInvestigador ? '#BFDBFE' : '#99F6E4'}`,
                borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600,
              }}>
                {isInvestigador ? 'Investigador' : 'Encuestador'}
              </span>
            }
          />
          <InfoRow
            label="Encuestas pendientes de sync"
            value={pendingCount > 0 ? `${pendingCount} local(es)` : 'Al día'}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button
            onClick={onSync}
            icon={syncing ? 'ti-loader-2' : 'ti-cloud-upload'}
            style={{ flex: 1 }}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </Button>
          <Button
            onClick={() => setConfirmSignOut(true)}
            icon="ti-logout"
            style={{ flex: 1, background: C.redLight, color: C.red }}
          >
            Cerrar sesión
          </Button>
        </div>
      </Card>

      {confirmSignOut && (
        <ConfirmDialog
          title="Cerrar sesión"
          icon="ti-logout"
          danger
          confirmLabel="Cerrar sesión"
          message={
            pendingCount > 0
              ? `Tienes ${pendingCount} encuesta(s) sin sincronizar. Si cierras sesión podrías perder esos datos locales. ¿Quieres cerrar sesión de todas formas?`
              : '¿Seguro que quieres cerrar sesión?'
          }
          onConfirm={onSignOut}
          onClose={() => setConfirmSignOut(false)}
        />
      )}
    </>
  )
}

// Static storage / schema information.
export function AppInfoSection({ surveyCount }: { surveyCount: number }) {
  return (
    <Card style={{ background: C.bg }}>
      <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        <InfoRow label="Encuestas almacenadas" value={surveyCount} />
        <InfoRow label="Almacenamiento" value="IndexedDB + Supabase" />
        <InfoRow label="Versión esquema" value="2.0 (codebook-aligned)" />
      </div>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: C.muted }}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
