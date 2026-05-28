import React, { useEffect } from 'react'
import { useStore } from './lib/store'
import { BottomNav, ToastContainer } from './components/layout'
import {
  DashboardPage, WizardPage, EncuestasPage,
  BuscarPage, ExportarPage, AjustesPage,
} from './pages'

export default function App() {
  const { view, loadSurveys, loadSettings, surveysLoaded } = useStore()

  useEffect(() => {
    loadSettings()
    loadSurveys()
  }, [])

  if (!surveysLoaded) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <i
          className="ti ti-loader-2"
          aria-label="Cargando…"
          style={{
            fontSize: 32, color: '#0F766E',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <h1 className="sr-only">MEDD — Aplicación de investigación de medicamentos no utilizados</h1>
      <ToastContainer />

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
