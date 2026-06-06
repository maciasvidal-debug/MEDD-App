import { useState, type CSSProperties } from 'react'
import { useStore } from '../lib/store'
import { isProfileComplete } from '../lib/validators'
import { OPT } from '../lib/constants'
import { Field, ChipGroup, Button, Logo, C } from '../components/ui'

// Mandatory first-run gate for encuestadores. The surveyor profile is stamped
// onto every captured survey, so we block entry until it is complete (App only
// renders this when userRole === 'encuestador' and the profile is incomplete).
// Sign-out stays available so the user is never trapped.
export default function ProfileOnboarding() {
  const { settings, persistSettings, signOut } = useStore()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const complete = isProfileComplete(form)

  async function handleSave() {
    if (!complete || saving) return
    setSaving(true)
    await persistSettings(form)
    setSaving(false)
  }

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 12px' }}>
            <Logo variant="tile" size={56} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
            Completa tu perfil
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: '8px 0 0', lineHeight: 1.5 }}>
            Estos datos se adjuntan a cada encuesta que captures y permiten el
            control de calidad por encuestador. Son obligatorios para empezar.
          </p>
        </div>

        <Field label="ID del encuestador" required>
          <input
            type="number" min={1}
            value={form.nuiEncuestador}
            onChange={e => set('nuiEncuestador')(e.target.value)}
            placeholder="Ej: 1012345678"
          />
        </Field>

        <Field label="Programa académico" required>
          <select value={form.etrPrograma} onChange={e => set('etrPrograma')(e.target.value)}>
            <option value="">— Selecciona —</option>
            {OPT.etrPrograma.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>

        <Field label="Tipo de institución" required>
          <ChipGroup options={OPT.etrTipoInst} value={form.etrTipoInst} onChange={set('etrTipoInst')} />
        </Field>

        <Field label="Semestre" hint="1 a 12" required>
          <input
            type="number" min={1} max={12}
            value={form.etrSemestre}
            onChange={e => set('etrSemestre')(e.target.value)}
            placeholder="Ej: 8"
          />
        </Field>

        <Field label="Institución educativa" required>
          <input
            value={form.etrInstitucion}
            onChange={e => set('etrInstitucion')(e.target.value)}
            placeholder="Ej: Universidad Nacional de Colombia"
          />
        </Field>

        <Button fullWidth disabled={!complete || saving} onClick={handleSave} icon="ti-check">
          {saving ? 'Guardando…' : 'Guardar y continuar'}
        </Button>

        <button
          type="button"
          onClick={() => signOut()}
          style={{
            marginTop: 12, width: '100%', background: 'none', border: 'none',
            color: C.muted, fontSize: 13, cursor: 'pointer',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--c-bg)', padding: '24px 16px',
  },
  card: {
    background: 'var(--c-surface)', borderRadius: 18, boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--c-border)', padding: '28px 24px', width: '100%', maxWidth: 420,
  },
}
