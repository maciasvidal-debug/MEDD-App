import React, { useEffect, Suspense } from 'react'
import { useStore } from './lib/store'
import { useShallow } from 'zustand/react/shallow'
import { BottomNav, SideNav, ToastContainer } from './components/layout'
import { C, Spinner, PageSkeleton } from './components/ui'
import AuthPage from './pages/auth'
import ProfileOnboarding from './pages/ProfileOnboarding'
import Welcome from './pages/Welcome'
import { isProfileComplete } from './lib/validators'
import { useNetworkStatus } from './hooks/useNetworkStatus'

// ⚡ Bolt: every route is code-split, not just the Dashboard. The app opens on
// one view at a time, so eagerly bundling all pages into the initial JS made the
// first paint download/parse code for screens the user may never open. Each page
// now loads on demand (mirrors the existing Dashboard split), shrinking the
// initial bundle to the app shell + the first view. Named exports are adapted to
// the default export React.lazy expects.
//
// One loader per route, shared by React.lazy (below) and the offline prefetch
// (in the App effect). This is an offline-first field app whose service worker
// caches assets on first fetch (stale-while-revalidate) — so a route that is
// never opened while online would NOT be cached and would fail to load offline.
// Prefetching every chunk on idle after first paint keeps them off the initial
// critical path yet ensures the capture Wizard (and the rest) work with no signal.
const loadRoute = {
  dashboard: () => import('./pages/Dashboard'),
  encuestas: () => import('./pages/EncuestasPage').then(m => ({ default: m.EncuestasPage })),
  wizard:    () => import('./pages/WizardPage').then(m => ({ default: m.WizardPage })),
  buscar:    () => import('./pages/BuscarPage').then(m => ({ default: m.BuscarPage })),
  exportar:  () => import('./pages/ExportarPage').then(m => ({ default: m.ExportarPage })),
  ajustes:   () => import('./pages/AjustesPage').then(m => ({ default: m.AjustesPage })),
}
const DashboardPage = React.lazy(loadRoute.dashboard)
const EncuestasPage = React.lazy(loadRoute.encuestas)
const WizardPage    = React.lazy(loadRoute.wizard)
const BuscarPage    = React.lazy(loadRoute.buscar)
const ExportarPage  = React.lazy(loadRoute.exportar)
const AjustesPage   = React.lazy(loadRoute.ajustes)

// Warm every route chunk in the background after first paint, so the service
// worker caches them while online and the offline-first flows stay available
// with no signal. Deferred to idle so it never competes with the initial load;
// dynamic imports are deduped, so a later navigation reuses the warmed module.
function prefetchRoutes() {
  const warm = () => { for (const load of Object.values(loadRoute)) load().catch(() => {}) }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warm)
  else setTimeout(warm, 2000)
}

function PageLoader() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )
}

export default function App() {
  // ⚡ Bolt: App is the router at the root of the tree, so any re-render here
  // reconciles the whole page tree (SideNav, the active page, BottomNav) — and
  // the pages aren't memoized, so a parent re-render even defeats the per-page
  // useShallow tuning below it. A bare `useStore()` re-rendered App on EVERY
  // state change, notably every transient toast push/auto-remove (~every 3.2s).
  // App never reads `toasts` (the ToastContainer owns those), so we subscribe
  // only to the slices App actually uses; toast churn no longer re-renders the app.
  const {
    view, loadSurveys, loadSettings, loadDraft, surveysLoaded, surveys,
    user, authReady, initAuth, syncing,
    settings, settingsLoaded, userRole, userActive,
    welcomeOpen, maybeOpenWelcome,
  } = useStore(
    useShallow(s => ({
      view: s.view,
      loadSurveys: s.loadSurveys,
      loadSettings: s.loadSettings,
      loadDraft: s.loadDraft,
      surveysLoaded: s.surveysLoaded,
      surveys: s.surveys,
      user: s.user,
      authReady: s.authReady,
      initAuth: s.initAuth,
      syncing: s.syncing,
      settings: s.settings,
      settingsLoaded: s.settingsLoaded,
      userRole: s.userRole,
      userActive: s.userActive,
      welcomeOpen: s.welcomeOpen,
      maybeOpenWelcome: s.maybeOpenWelcome,
    })),
  )

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

  // Prefetch the code-split route chunks on idle so they're service-worker
  // cached while online and remain available offline (see loadRoute above).
  useEffect(() => { prefetchRoutes() }, [])

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

  // Logged in but the account hasn't been approved by the coordinator
  // (user_roles.active = false). RLS already blocks their writes server-side;
  // this gives a clear message instead of silent sync failures. userActive
  // defaults true, so this only triggers on an explicit inactive row.
  if (!userActive) return <PendingApproval email={user.email} />

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

            {/* Pages — each route is a separate lazy chunk; one Suspense covers
                the brief fetch while a newly-opened view's chunk loads. */}
            <Suspense fallback={<PageLoader />}>
              {view === 'dashboard'  && <DashboardPage />}
              {view === 'encuestas'  && <EncuestasPage />}
              {view === 'wizard'     && <WizardPage />}
              {view === 'buscar'     && <BuscarPage />}
              {view === 'exportar'   && <ExportarPage />}
              {view === 'ajustes'    && <AjustesPage />}
            </Suspense>
          </>
        )}

        {/* Bottom navigation — hidden during wizard (mobile only; CSS hides ≥900px) */}
        {view !== 'wizard' && <BottomNav />}
      </div>
    </div>
  )
}

// Shown when a signed-in account is not yet approved (user_roles.active=false).
// Accounts are provisioned by the study coordinator; a fresh account is inactive
// until the coordinator activates it, so this is the honest "waiting room" state
// rather than dropping the user into an app whose writes the RLS will reject.
function PendingApproval({ email }: { email?: string }) {
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

// Persistent offline indicator: the app is offline-first (IndexedDB + deferred
// sync), so the key reassurance is that data is being saved locally meanwhile.
function NetworkBanner() {
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
function PendingSyncBanner() {
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
