import React, { useEffect } from 'react'
import { useStore } from './lib/store'
import { BottomNav, ToastContainer } from './components/layout'
import { C } from './components/ui'
import {
  DashboardPage, WizardPage, EncuestasPage,
  BuscarPage, ExportarPage, AjustesPage,
} from './pages'
import AuthPage from './pages/auth'

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
      {view === 'dashboard'  && <DashboardPage />}
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
