import React from 'react'

interface Props { children: React.ReactNode }
interface State { error: Error | null }

// App-wide safety net: without this, any uncaught render error unmounts the whole
// React tree and leaves a blank white screen (WSOD) with no way out. Here we catch
// it and offer two recoveries — a plain reload, and a "clear local data + reload"
// that wipes IndexedDB/localStorage (what previously had to be done by hand from
// the dev console) for the case where persisted data is what triggers the crash.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the real cause in the console for debugging.
    console.error('Unhandled error caught by ErrorBoundary:', error, info)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  handleClearData = async () => {
    try {
      // Wipe the app's local persistence so a corrupt draft/survey can't keep
      // crashing the app on every load.
      if (window.indexedDB?.databases) {
        const dbs = await window.indexedDB.databases()
        await Promise.all(
          dbs.map(db => db.name && window.indexedDB.deleteDatabase(db.name)),
        )
      } else {
        window.indexedDB?.deleteDatabase('medd_db')
      }
      localStorage.clear()
    } catch (e) {
      console.error('Failed to clear local data:', e)
    } finally {
      window.location.reload()
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          background: '#F0FDF9', padding: '24px 20px', gap: 14,
        }}
      >
        <i className="ti ti-alert-triangle" style={{ fontSize: 40, color: '#B45309' }} aria-hidden />
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', margin: 0 }}>
          Algo salió mal
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', maxWidth: 340, lineHeight: 1.5, margin: 0 }}>
          La aplicación encontró un error inesperado. Puedes recargar para
          intentarlo de nuevo. Si el problema continúa, limpia los datos locales
          (esto borra las encuestas no sincronizadas guardadas en este dispositivo).
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          <button
            onClick={this.handleReload}
            style={{
              minHeight: 44, padding: '11px 20px', borderRadius: 8, border: 'none',
              background: '#0F766E', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Recargar
          </button>
          <button
            onClick={this.handleClearData}
            style={{
              minHeight: 44, padding: '11px 20px', borderRadius: 8,
              border: '1px solid #FCA5A5', background: '#FEE2E2', color: '#B91C1C',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Limpiar datos y recargar
          </button>
        </div>
      </div>
    )
  }
}
