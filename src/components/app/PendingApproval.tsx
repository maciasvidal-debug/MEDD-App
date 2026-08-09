import React from 'react'
import { useStore } from '../../lib/store'
import { C } from '../../components/ui'

// Shown when a signed-in account is not yet approved (user_roles.active=false).
// Accounts are provisioned by the study coordinator; a fresh account is inactive
// until the coordinator activates it, so this is the honest "waiting room" state
// rather than dropping the user into an app whose writes the RLS will reject.
export function PendingApproval({ email }: { email?: string }) {
  const signOut = useStore(s => s.signOut)
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, padding: '24px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, textAlign: 'center',
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18,
        boxShadow: 'var(--shadow-lg)', padding: '32px 28px',
      }}>
        <div style={{
          width: 60, height: 60, margin: '0 auto 16px', borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: C.amberLight,
        }}>
          <i className="ti ti-clock-hour-4" style={{ fontSize: 30, color: C.amber }} aria-hidden />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>
          Cuenta pendiente de aprobación
        </h1>
        <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, margin: '0 0 20px' }}>
          Tu cuenta{email ? <> (<strong>{email}</strong>)</> : ''} aún no ha sido activada.
          Contacta al coordinador del estudio para habilitar el acceso.
        </p>
        <button
          onClick={() => signOut()}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.surface2, color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <i className="ti ti-logout" style={{ fontSize: 17 }} aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
