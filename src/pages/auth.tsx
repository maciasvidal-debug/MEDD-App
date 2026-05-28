import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

type AuthMode = 'login' | 'register'

export default function AuthPage() {
  const [mode, setMode]       = useState<AuthMode>('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [info, setInfo]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setInfo('Revisa tu correo para confirmar el registro.')
    }
    setLoading(false)
  }

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        {/* Logo / título */}
        <div style={styles.header}>
          <span style={styles.logo}>MEDD</span>
          <p style={styles.subtitle}>Medicamentos no utilizados — Colombia</p>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
            onClick={() => { setMode('login'); setError(null); setInfo(null) }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
            onClick={() => { setMode('register'); setError(null); setInfo(null) }}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Correo electrónico</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPass(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}
          {info  && <p style={styles.info}>{info}</p>}

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading
              ? <i className="ti ti-loader-2" style={{ animation: 'spin 0.8s linear infinite' }} />
              : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F0FDF9',
    padding: '24px 16px',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(15,118,110,0.10)',
    padding: '32px 28px',
    width: '100%',
    maxWidth: 380,
  },
  header: {
    textAlign: 'center',
    marginBottom: 24,
  },
  logo: {
    fontSize: 32,
    fontWeight: 800,
    color: '#0F766E',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  tabs: {
    display: 'flex',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #E2E8F0',
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    padding: '9px 0',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: '#64748B',
    transition: 'background 0.15s, color 0.15s',
  },
  tabActive: {
    background: '#0F766E',
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
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#374151',
  },
  error: {
    fontSize: 12,
    color: '#B91C1C',
    background: '#FEE2E2',
    borderRadius: 6,
    padding: '8px 10px',
  },
  info: {
    fontSize: 12,
    color: '#166534',
    background: '#DCFCE7',
    borderRadius: 6,
    padding: '8px 10px',
  },
  btn: {
    background: '#0F766E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 8,
    padding: '11px 0',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 0.15s',
  },
}
