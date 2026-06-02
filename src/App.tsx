import React, { useEffect, Suspense } from 'react'
import { useStore } from './lib/store'
import { BottomNav, ToastContainer } from './components/layout'
import { C, Spinner } from './components/ui'
import {
  WizardPage, EncuestasPage,
  BuscarPage, ExportarPage, AjustesPage,
} from './pages'
import AuthPage from './pages/auth'

// Dashboard pulls in Recharts (heavy); load it on demand so it stays out of the
// initial bundle and only downloads when the user opens the panel.
const DashboardPage = React.lazy(() => import('./pages/Dashboard'))

function PageLoader() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )
}

export default function App() {
  const {
    view, loadSurveys, loadSettings, loadDraft, surveysLoaded,
    user, authReady, initAuth, syncing,
  } = useStore()

  // Subscribe to Supabase auth state changes
  useEffect(() => {
    const unsub = initAuth()
    return unsub
  }, [])

  // Load local data once authenticated
  useEffect(() => {
    if (user) {
      loadSettings()
      loadSurveys()
      loadDraft()
    }
  }, [user])

  // Auth not resolved yet
  if (!authReady) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <i
          className="ti ti-loader-2"
          aria-label="Cargando…"
          style={{ fontSize: 32, color: '#0F766E', animation: 'spin 0.8s linear infinite' }}
        />
      </div>
    )
  }

  // Not logged in
  if (!user) return <AuthPage />

  // Surveys loading
  if (!surveysLoaded) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <i
          className="ti ti-loader-2"
          aria-label="Cargando…"
          style={{ fontSize: 32, color: '#0F766E', animation: 'spin 0.8s linear infinite' }}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <h1 className="sr-only">MEDD — Aplicación de investigación de medicamentos no utilizados</h1>
      <NetworkBanner />
      <ToastContainer />

      {/* Resume an in-progress survey saved before a reload */}
      {view !== 'wizard' && <ResumeDraftBanner />}

      {/* Sync indicator */}
      {syncing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, #0F766E, #14B8A6)',
          zIndex: 300,
          animation: 'slideProgress 2s ease-in-out infinite',
        }} />
      )}

      {/* Pages */}
      {view === 'dashboard'  && (
        <Suspense fallback={<PageLoader />}>
          <DashboardPage />
        </Suspense>
      )}
      {view === 'encuestas'  && <EncuestasPage />}
      {view === 'wizard'     && <WizardPage />}
      {view === 'buscar'     && <BuscarPage />}
      {view === 'exportar'   && <ExportarPage />}
      {view === 'ajustes'    && <AjustesPage />}

      {/* Bottom navigation — hidden during wizard */}
      {view !== 'wizard' && <BottomNav />}
    </div>
  )
}

// Persistent offline indicator: the app is offline-first (IndexedDB + deferred
// sync), so the key reassurance is that data is being saved locally meanwhile.
function NetworkBanner() {
  const [online, setOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  useEffect(() => {
    const goOnline  = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

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

// Surfaced when a wizard draft was persisted (e.g. the tab was closed mid-survey)
// so the encuestador can pick up exactly where they left off instead of losing it.
function ResumeDraftBanner() {
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
          border: 'none', background: C.teal, color: '#fff',
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
