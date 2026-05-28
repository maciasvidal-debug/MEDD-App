import React, { useEffect } from 'react'
import { useStore } from './lib/store'
import { BottomNav, ToastContainer } from './components/layout'
import {
  DashboardPage, WizardPage, EncuestasPage,
  BuscarPage, ExportarPage, AjustesPage,
} from './pages'
import AuthPage from './pages/auth'

export default function App() {
  const {
    view, loadSurveys, loadSettings, surveysLoaded,
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
