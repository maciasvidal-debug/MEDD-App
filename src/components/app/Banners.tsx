import { useStore } from '../../lib/store'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { C } from '../../components/ui'

// Persistent offline indicator: the app is offline-first (IndexedDB + deferred
// sync), so the key reassurance is that data is being saved locally meanwhile.
export function NetworkBanner() {
  const online = useNetworkStatus()

  if (online) return null
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: C.amberLight, color: C.amber, fontSize: 12, fontWeight: 500,
        padding: '6px 12px', borderBottom: `0.5px solid ${C.amber}40`,
      }}
    >
      <i className="ti ti-wifi-off" style={{ fontSize: 14 }} aria-hidden />
      Sin conexión — los datos se guardan localmente y se sincronizarán al reconectar
    </div>
  )
}

// Surfaces unsynced surveys so a field worker can trust (and force) the upload
// instead of wondering whether data left the device. Shows only when online,
// not already syncing, and there is something pending — otherwise renders null.
export function PendingSyncBanner() {
  const { surveys, syncing, triggerSync } = useStore()
  const online = useNetworkStatus()

  const pending = surveys.filter(s => s.syncStatus !== 'synced').length
  if (!online || syncing || pending === 0) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.tealLight, color: C.teal,
        padding: '8px 12px', borderBottom: `0.5px solid ${C.teal}40`,
        fontSize: 12.5, fontWeight: 500,
      }}
    >
      <i className="ti ti-cloud-up" style={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
      <span style={{ flex: 1, minWidth: 0 }}>
        {pending} encuesta{pending !== 1 ? 's' : ''} sin sincronizar.
      </span>
      <button
        onClick={() => triggerSync()}
        style={{
          flexShrink: 0, border: 'none', background: C.teal, color: '#fff',
          borderRadius: 7, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Sincronizar
      </button>
    </div>
  )
}

// Non-blocking nudge for returning encuestadores whose surveyor profile is
// incomplete. They keep full access to their existing data; this just routes
// them to finish the profile (also enforced as a hard gate at the wizard).
export function ProfileBanner() {
  const setView = useStore(s => s.setView)
  return (
    <div
      role="region"
      aria-label="Perfil incompleto"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.amberLight, color: C.amber,
        padding: '8px 12px', borderBottom: `0.5px solid ${C.amber}40`,
        fontSize: 12.5, fontWeight: 500,
      }}
    >
      <i className="ti ti-user-exclamation" style={{ fontSize: 16, flexShrink: 0 }} aria-hidden />
      <span style={{ flex: 1, minWidth: 0 }}>
        Tu perfil de encuestador está incompleto — complétalo para poder registrar encuestas.
      </span>
      <button
        onClick={() => setView('ajustes')}
        style={{
          flexShrink: 0, border: 'none', background: C.amber, color: '#fff',
          borderRadius: 7, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Completar
      </button>
    </div>
  )
}

// Surfaced when a wizard draft was persisted (e.g. the tab was closed mid-survey)
// so the encuestador can pick up exactly where they left off instead of losing it.
export function ResumeDraftBanner() {
  const { pendingDraft, resumeDraft, discardDraft } = useStore()
  if (!pendingDraft) return null

  const { draft, step, editingId } = pendingDraft
  return (
    <div
      role="region"
      aria-label="Encuesta sin terminar"
      style={{
        margin: '12px 16px 0', padding: '10px 12px',
        background: C.tealLight, border: `0.5px solid ${C.teal}40`,
        borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <i className="ti ti-history" style={{ fontSize: 18, color: C.teal, flexShrink: 0 }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.teal }}>
          {editingId ? 'Edición sin guardar' : `Encuesta #${draft.nui} sin terminar`}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>Quedó en el paso {step} de 6.</div>
      </div>
      <button
        onClick={resumeDraft}
        style={{
          flexShrink: 0, minHeight: 40, padding: '8px 14px', borderRadius: 8,
          border: 'none', background: C.primary, color: '#fff',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        Continuar
      </button>
      <button
        aria-label="Descartar borrador"
        onClick={() => discardDraft()}
        style={{
          flexShrink: 0, width: 40, height: 40, borderRadius: 8,
          border: 'none', background: 'transparent', color: C.muted,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden />
      </button>
    </div>
  )
}
