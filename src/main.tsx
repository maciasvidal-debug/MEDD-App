import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted Inter (variable) — bundled into the build so it works offline
// (the app is offline-first) instead of relying on a font CDN.
import '@fontsource-variable/inter'
// Space Grotesk (variable) — display face for titles and large figures; gives
// the UI a distinct, modern identity instead of the default-Inter template look.
import '@fontsource-variable/space-grotesk'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

// Register the service worker (production only) so the field app installs and
// loads offline. Dev is skipped to avoid caching the Vite dev server.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
