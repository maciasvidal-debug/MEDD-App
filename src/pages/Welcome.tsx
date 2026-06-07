import { useState, useRef, useId, type CSSProperties } from 'react'
import { useStore } from '../lib/store'
import { Button, C } from '../components/ui'
import { useFocusTrap } from '../components/ui/useFocusTrap'

interface Step { icon: string; title: string; body: string }

// Role-aware first-run tour. Encuestadores get the capture/offline/sync flow;
// investigadores (read-only analysts) get the dashboard/filter/export flow.
const ENCUESTADOR_STEPS: Step[] = [
  { icon: 'ti-clipboard-plus', title: 'Registra encuestas',
    body: 'Pulsa «Nueva encuesta» y completa los 6 pasos. Puedes pausar y retomar: tu avance se guarda solo.' },
  { icon: 'ti-cloud-check', title: 'Funciona sin conexión',
    body: 'Captura en campo aunque no tengas señal. Todo se guarda en el dispositivo y se sincroniza automáticamente al reconectar.' },
  { icon: 'ti-list-check', title: 'Revisa y exporta',
    body: 'En «Registros» ves y editas tus encuestas; en «Exportar» descargas los datos en CSV.' },
  { icon: 'ti-user-shield', title: 'Tu perfil importa',
    body: 'Tu perfil de encuestador se adjunta a cada encuesta para el control de calidad. Mantenlo al día en Ajustes.' },
]
const INVESTIGADOR_STEPS: Step[] = [
  { icon: 'ti-layout-dashboard', title: 'Panel analítico',
    body: 'Visualiza indicadores agregados de todas las encuestas: prevalencias, asociaciones y control de calidad.' },
  { icon: 'ti-adjustments-horizontal', title: 'Filtra el análisis',
    body: 'Acota por ciudad, estrato, régimen de salud o programa del encuestador para explorar subgrupos.' },
  { icon: 'ti-file-download', title: 'Exporta los datos',
    body: 'Descarga el conjunto (filtrado o completo) en CSV para tus análisis externos.' },
]

export default function Welcome() {
  const { userRole, closeWelcome } = useStore()
  const steps = userRole === 'investigador' ? INVESTIGADOR_STEPS : ENCUESTADOR_STEPS
  const [i, setI] = useState(0)
  const last = i === steps.length - 1
  const step = steps[i]
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useFocusTrap(panelRef, closeWelcome)

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={panelRef} tabIndex={-1} style={{ ...styles.card, outline: 'none' }}>
        <button type="button" onClick={closeWelcome} style={styles.skip} aria-label="Saltar introducción">
          Saltar
        </button>

        <div style={styles.iconWrap} aria-hidden>
          <i className={`ti ${step.icon}`} style={{ fontSize: 34, color: C.teal }} />
        </div>
        <h2 id={titleId} style={styles.title}>{step.title}</h2>
        <p style={styles.body}>{step.body}</p>

        <div style={styles.dots} aria-hidden>
          {steps.map((_, idx) => (
            <span key={idx} style={{
              width: idx === i ? 18 : 7, height: 7, borderRadius: 999,
              background: idx === i ? C.teal : C.border, transition: 'all 0.2s',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {i > 0 && (
            <Button variant="ghost" style={{ flex: 1 }} onClick={() => setI(n => n - 1)} icon="ti-arrow-left">
              Anterior
            </Button>
          )}
          {last ? (
            <Button style={{ flex: 1 }} onClick={closeWelcome} icon="ti-check">
              Empezar
            </Button>
          ) : (
            <Button style={{ flex: 1 }} onClick={() => setI(n => n + 1)} iconRight="ti-arrow-right">
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 400,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(15, 23, 38, 0.55)', padding: '24px 16px',
    backdropFilter: 'blur(2px)',
  },
  card: {
    position: 'relative', width: '100%', maxWidth: 380, textAlign: 'center',
    background: 'var(--c-surface)', borderRadius: 18, padding: '32px 24px 24px',
    boxShadow: 'var(--shadow-lg)', border: '1px solid var(--c-border)',
  },
  skip: {
    position: 'absolute', top: 12, right: 14, background: 'none', border: 'none',
    color: 'var(--c-muted)', fontSize: 13, cursor: 'pointer',
  },
  iconWrap: {
    width: 64, height: 64, margin: '0 auto 14px', borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: C.tealLight,
  },
  title: { fontSize: 19, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 8px' },
  body: { fontSize: 13.5, color: 'var(--c-muted)', lineHeight: 1.55, margin: '0 0 20px' },
  dots: { display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' },
}
