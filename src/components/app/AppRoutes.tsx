/* eslint-disable react-refresh/only-export-components */
import React, { Suspense } from 'react'
import { Spinner } from '../../components/ui'
import type { AppView } from '../../types'

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
  dashboard: () => import('../../pages/Dashboard'),
  encuestas: () => import('../../pages/EncuestasPage').then(m => ({ default: m.EncuestasPage })),
  wizard:    () => import('../../pages/WizardPage').then(m => ({ default: m.WizardPage })),
  buscar:    () => import('../../pages/BuscarPage').then(m => ({ default: m.BuscarPage })),
  exportar:  () => import('../../pages/ExportarPage').then(m => ({ default: m.ExportarPage })),
  ajustes:   () => import('../../pages/AjustesPage').then(m => ({ default: m.AjustesPage })),
}

const DashboardPage = React.lazy(loadRoute.dashboard)
const EncuestasPage = React.lazy(loadRoute.encuestas)
const WizardPage    = React.lazy(loadRoute.wizard)
const BuscarPage    = React.lazy(loadRoute.buscar)
const ExportarPage  = React.lazy(loadRoute.exportar)
const AjustesPage   = React.lazy(loadRoute.ajustes)

function PageLoader() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner size={28} />
    </div>
  )
}

export function AppRoutes({ view }: { view: AppView }) {
  return (
    <Suspense fallback={<PageLoader />}>
      {view === 'dashboard'  && <DashboardPage />}
      {view === 'encuestas'  && <EncuestasPage />}
      {view === 'wizard'     && <WizardPage />}
      {view === 'buscar'     && <BuscarPage />}
      {view === 'exportar'   && <ExportarPage />}
      {view === 'ajustes'    && <AjustesPage />}
    </Suspense>
  )
}

// Warm every route chunk in the background after first paint, so the service
// worker caches them while online and the offline-first flows stay available
// with no signal. Deferred to idle so it never competes with the initial load;
// dynamic imports are deduped, so a later navigation reuses the warmed module.
export function prefetchRoutes() {
  const warm = () => { for (const load of Object.values(loadRoute)) load().catch(() => {}) }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warm)
  else setTimeout(warm, 2000)
}
