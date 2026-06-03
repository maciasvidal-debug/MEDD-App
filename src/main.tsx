import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted Inter (variable) — bundled into the build so it works offline
// (the app is offline-first) instead of relying on a font CDN.
import '@fontsource-variable/inter'
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
