import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Logo, C } from '../components/ui'

type AuthMode = 'login' | 'register'

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

export default function AuthPage() {
  const [mode, setMode]       = useState<AuthMode>('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [info, setInfo]       = useState<string | null>(null)

  // Mirror the Supabase password policy (min 6 + lower/upper/digit/symbol) on the
  // client so users see the rules and get a friendly message, instead of passing
  // local validation only to be rejected by the server with a raw English error.
  const pwChecks = [
    { ok: password.length >= 6,        label: 'Mínimo 6 caracteres' },
    { ok: /[a-z]/.test(password),      label: 'Una minúscula' },
    { ok: /[A-Z]/.test(password),      label: 'Una mayúscula' },
    { ok: /\d/.test(password),         label: 'Un número' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Un símbolo' },
  ]
  const passwordValid = pwChecks.every(c => c.ok)
  const submitDisabled = loading || (mode === 'register' && !passwordValid)

  function switchMode(next: AuthMode) {
    setMode(next); setError(null); setInfo(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    // Enforce the policy on registration only — existing accounts may predate it,
    // so login must never be blocked by a format check.
    if (mode === 'register' && !passwordValid) {
      setError('La contraseña debe tener mínimo 6 caracteres e incluir mayúscula, minúscula, número y símbolo.')
      return
    }
    setLoading(true)

    // try/finally so a thrown network error (no connectivity, DNS, CORS) still
    // clears the spinner and surfaces a message, instead of hanging the button.
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(error.message)
        } else if (data.session) {
          // Email confirmation is disabled → signUp returns a session and the user
          // is already signed in. The auth listener (store.initAuth) picks up the
          // SIGNED_IN event and routes into the app, so no message is needed here.
        } else {
          // Email confirmation is enabled → no session yet; the user must verify
          // via the emailed link before logging in.
          setInfo('Cuenta creada. Revisa tu correo para confirmar el registro.')
        }
      }
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

          {/* Tabs */}
          <div style={styles.tabs} role="tablist" aria-label="Autenticación">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
              onClick={() => switchMode('login')}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
              onClick={() => switchMode('register')}
            >
              Registrarse
            </button>
          </div>

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
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  enterKeyHint="go"
                  value={password}
                  onChange={e => setPass(e.target.value)}
                  placeholder={mode === 'register' ? 'Crea una contraseña segura' : 'Tu contraseña'}
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
              {mode === 'register' && password.length > 0 && (
                <ul style={styles.pwList} aria-label="Requisitos de la contraseña">
                  {pwChecks.map(c => (
                    <li key={c.label} style={{ ...styles.pwItem, color: c.ok ? C.green : C.muted }}>
                      <i className={`ti ${c.ok ? 'ti-circle-check-filled' : 'ti-circle'}`} style={{ fontSize: 14 }} aria-hidden />
                      {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p role="alert" aria-live="assertive" style={styles.error}>{error}</p>}
            {info  && <p role="alert" aria-live="assertive" style={styles.info}>{info}</p>}

            <Button
              type="submit"
              size="lg"
              fullWidth
              disabled={submitDisabled}
              icon={loading ? undefined : (mode === 'login' ? 'ti-login-2' : 'ti-user-plus')}
              style={{ marginTop: 4 }}
            >
              {loading
                ? <i className="ti ti-loader-2" style={{ animation: 'spin 0.8s linear infinite', fontSize: 17 }} aria-hidden />
                : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    textAlign: 'center',
    marginBottom: 24,
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
  tabs: {
    display: 'flex',
    borderRadius: 10,
    overflow: 'hidden',
    border: `1px solid ${C.border}`,
    background: C.surface2,
    padding: 3,
    gap: 3,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    padding: '9px 0',
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    color: C.muted,
    transition: 'background 0.15s, color 0.15s',
  },
  tabActive: {
    background: C.teal,
    color: '#FFFFFF',
    fontWeight: 600,
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
  pwList: {
    listStyle: 'none',
    margin: '8px 0 0',
    padding: 0,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px 12px',
  },
  pwItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    transition: 'color 0.15s',
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
  info: {
    fontSize: 12,
    color: C.green,
    background: C.greenLight,
    borderRadius: 8,
    padding: '8px 10px',
  },
}
