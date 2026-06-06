import React, { useEffect, Suspense } from 'react'
import { useStore } from './lib/store'
import { BottomNav, SideNav, ToastContainer } from './components/layout'
import { C, Spinner, PageSkeleton } from './components/ui'
import {
  WizardPage, EncuestasPage,
  BuscarPage, ExportarPage, AjustesPage,
} from './pages'
import AuthPage from './pages/auth'
import ProfileOnboarding from './pages/ProfileOnboarding'
import Welcome from './pages/Welcome'
import { isProfileComplete } from './lib/validators'

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
    view, loadSurveys, loadSettings, loadDraft, surveysLoaded, surveys,
    user, authReady, initAuth, syncing,
    settings, settingsLoaded, userRole,
    welcomeOpen, maybeOpenWelcome,
  } = useStore()

  // Whether an encuestador still owes a complete surveyor profile. Computed here
  // (before any early return) so the welcome effect below can avoid popping over
  // the mandatory profile screen — React hooks must run unconditionally.
  const profileIncomplete =
    userRole === 'encuestador' && settingsLoaded && !isProfileComplete(settings)
  const onMandatoryProfile = profileIncomplete && surveysLoaded && surveys.length === 0

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

  // First-run welcome tour: auto-open once the app proper is shown (role known,
  // settings loaded, and not sitting on the mandatory profile screen).
  useEffect(() => {
    if (user && userRole && settingsLoaded && !onMandatoryProfile) {
      maybeOpenWelcome()
    }
  }, [user, userRole, settingsLoaded, onMandatoryProfile])

  // Auth not resolved yet
  if (!authReady) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={32} />
      </div>
    )
  }

  // Not logged in
  if (!user) return <AuthPage />

  // Surveyor profile gate. The profile is stamped onto every survey, so an
  // encuestador with an incomplete profile is taken straight to a mandatory
  // onboarding when they have no surveys yet (brand-new account). Returning
  // users with data instead see a non-blocking banner (below) and are stopped
  // at the wizard (store.openWizard) — so they're never blocked from their data.
  if (onMandatoryProfile) {
    return <ProfileOnboarding />
  }

  return (
    <div className="app-root">
      {/* Desktop/tablet left rail (hidden on phones via CSS) */}
      <SideNav />

      <div className="app-shell">
        <h1 className="sr-only">MEDD — Aplicación de investigación de medicamentos no utilizados</h1>
        <NetworkBanner />
        {profileIncomplete && <ProfileBanner />}
        <PendingSyncBanner />
        <ToastContainer />
        {welcomeOpen && <Welcome />}

        {/* Sync indicator */}
        {syncing && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 3,
            background: 'linear-gradient(90deg, #0F766E, #14B8A6)',
            zIndex: 300,
            animation: 'slideProgress 2s ease-in-out infinite',
          }} />
        )}

        {/* Surveys still loading → skeleton (perceived performance) */}
        {!surveysLoaded ? (
          <PageSkeleton />
        ) : (
          <>
            {/* Resume an in-progress survey saved before a reload */}
            {view !== 'wizard' && <ResumeDraftBanner />}

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
          </>
        )}

        {/* Bottom navigation — hidden during wizard (mobile only; CSS hides ≥900px) */}
        {view !== 'wizard' && <BottomNav />}
      </div>
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

// Surfaces unsynced surveys so a field worker can trust (and force) the upload
// instead of wondering whether data left the device. Shows only when online,
// not already syncing, and there is something pending — otherwise renders null.
function PendingSyncBanner() {
  const { surveys, syncing, triggerSync } = useStore()
  const [online, setOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

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
function ProfileBanner() {
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
