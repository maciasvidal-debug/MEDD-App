import React, { useEffect } from 'react'
import { useStore } from './lib/store'
import { useShallow } from 'zustand/react/shallow'
import { BottomNav, SideNav, ToastContainer } from './components/layout'
import { Spinner, PageSkeleton } from './components/ui'
import AuthPage from './pages/auth'
import ProfileOnboarding from './pages/ProfileOnboarding'
import Welcome from './pages/Welcome'
import { isProfileComplete } from './lib/validators'

import { AppRoutes, prefetchRoutes } from './components/app/AppRoutes'
import { PendingApproval } from './components/app/PendingApproval'
import {
  NetworkBanner,
  PendingSyncBanner,
  ProfileBanner,
  ResumeDraftBanner,
} from './components/app/Banners'

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
  }, [initAuth])

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
  }, [user, loadDraft, loadSettings, loadSurveys])

  // First-run welcome tour: auto-open once the app proper is shown (role known,
  // settings loaded, and not sitting on the mandatory profile screen).
  useEffect(() => {
    if (user && userRole && settingsLoaded && !onMandatoryProfile) {
      maybeOpenWelcome()
    }
  }, [user, userRole, settingsLoaded, onMandatoryProfile, maybeOpenWelcome])

  // Not ready yet (auth loading)
  if (!authReady) {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <AppRoutes view={view} />
          </>
        )}

        {/* Bottom navigation — hidden during wizard (mobile only; CSS hides ≥900px) */}
        {view !== 'wizard' && <BottomNav />}
      </div>
    </div>
  )
}
