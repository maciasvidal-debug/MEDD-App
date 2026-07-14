import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Logo, C } from '../components/ui'

// Trust signals shown on the desktop brand panel. Grounded in what the product
// actually does (offline-first capture, cross-device sync, per-user RLS) — no
// invented claims, just the reassurances a field worker needs on day one.
const FEATURES = [
  { icon: 'ti-cloud-check', title: 'Funciona sin conexión',
    body: 'Captura en campo aunque no haya señal. Todo se guarda en el dispositivo.' },
  { icon: 'ti-refresh', title: 'Sincronización automática',
    body: 'Tus encuestas viajan entre dispositivos en cuanto vuelve la conexión.' },
  { icon: 'ti-lock', title: 'Datos protegidos',
    body: 'Cada usuario solo ve y edita sus propios registros (RLS por cuenta).' },
]

// Login-only: public sign-up is disabled (accounts are provisioned by the study
// coordinator in Supabase), so there is no "Registrarse" tab. Access control and
// account approval live server-side (RLS + user_roles.active); see migration 015.
export default function AuthPage() {
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // try/finally so a thrown network error (no connectivity, DNS, CORS) still
    // clears the spinner and surfaces a message, instead of hanging the button.
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      // On success the auth listener (store.initAuth) picks up SIGNED_IN and routes
      // into the app, so nothing else is needed here.
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      {/* Brand / value panel — desktop only (see .auth-brand in global.css) */}
      <aside className="auth-brand" aria-hidden>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo variant="tile" size={44} />
          <span className="fd" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>MEDD</span>
        </div>
        <div>
          <h1 className="fd" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.12, letterSpacing: '-0.02em', maxWidth: 460 }}>
            Datos de campo, sin perder una sola encuesta.
          </h1>
          <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', maxWidth: 440 }}>
            Registro de medicamentos no utilizados en hogares para el Programa de Regencia en Farmacia.
          </p>
        </div>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 460 }}>
          {FEATURES.map(f => (
            <li key={f.title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
              <span style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)',
              }}>
                <i className={`ti ${f.icon}`} style={{ fontSize: 19 }} />
              </span>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, marginTop: 2 }}>{f.body}</div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Form column */}
      <main className="auth-panel">
        <div className="auth-card">
          {/* Compact brand header — carries the identity on mobile where the
              brand panel is hidden; stays as a quiet anchor on desktop. */}
          <div style={styles.header}>
            <div style={{ width: 60, height: 60, margin: '0 auto 14px' }}>
              <Logo variant="tile" size={60} />
            </div>
            <span style={styles.logo}>MEDD</span>
            <p style={styles.subtitle}>Medicamentos no utilizados — Colombia</p>
          </div>

          <h1 style={styles.heading}>Iniciar sesión</h1>

          {/* Form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label htmlFor="email" style={styles.label}>Correo electrónico</label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                enterKeyHint="next"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="password" style={styles.label}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  enterKeyHint="go"
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  placeholder="Tu contraseña"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPw}
                  tabIndex={-1}
                  style={styles.pwToggle}
                >
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: 18 }} aria-hidden />
                </button>
              </div>
            </div>

            {error && <p role="alert" aria-live="assertive" style={styles.error}>{error}</p>}

            <Button
              type="submit"
              size="lg"
              fullWidth
              disabled={loading}
              icon={loading ? undefined : 'ti-login-2'}
              style={{ marginTop: 4 }}
            >
              {loading
                ? <i className="ti ti-loader-2" style={{ animation: 'spin 0.8s linear infinite', fontSize: 17 }} aria-hidden />
                : 'Ingresar'}
            </Button>

            {/* Accounts are provisioned by the study coordinator (no public
                sign-up), and password recovery is admin-assisted — email
                confirmation is off and no SMTP is configured, so an in-app email
                reset would dead-end. Point users to the coordinator. */}
            <p style={styles.recovery}>
              ¿Sin cuenta o contraseña olvidada? Contacta al coordinador del estudio.
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    textAlign: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 32,
    fontWeight: 800,
    color: C.text,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: 12,
    color: C.muted,
    marginTop: 4,
  },
  heading: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
    textAlign: 'center',
    marginBottom: 18,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  pwToggle: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
    width: 42,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: C.muted,
    cursor: 'pointer',
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: C.text,
  },
  error: {
    fontSize: 12,
    color: C.red,
    background: C.redLight,
    borderRadius: 8,
    padding: '8px 10px',
  },
  recovery: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 1.5,
    marginTop: 2,
  },
}
