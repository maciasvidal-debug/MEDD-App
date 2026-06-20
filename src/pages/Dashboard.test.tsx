// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from './Dashboard'
import { useStore } from '../lib/store'
import type { Survey } from '../types'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const mkSurvey = (id: string, over: Partial<Survey> = {}): Survey => ({
  id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  nui: 1, fEta: '2026-01-10', fNac: '1990-01-01', ciudad: 'Bogotá',
  estrato: 3, asSalud: 'Contributivo', medSob: 'Sí', vtoMedNc: 'Sí',
  cantMed: 4, cantMedVto: 2, medications: [], syncStatus: 'synced', ...over,
}) as unknown as Survey

beforeEach(() => {
  useStore.setState({ surveys: [], userRole: 'investigador', pendingDraft: null })
})

describe('DashboardPage', () => {
  it('shows the empty state when there are no surveys', () => {
    render(<DashboardPage />)
    expect(screen.getByText('Panel analítico')).toBeInTheDocument()
  })

  it('renders the analytics view (incl. Recharts) without crashing when data exists', () => {
    useStore.setState({
      surveys: [
        mkSurvey('a'),
        mkSurvey('b', { ciudad: 'Cali', estrato: 2, medSob: 'No' }),
      ],
    })
    render(<DashboardPage />)
    // The populated header replaces the empty state.
    expect(screen.getAllByText(/Panel analítico|Análisis/i).length).toBeGreaterThan(0)
    // The exploratory / multiplicity disclaimer is shown alongside the inference.
    expect(screen.getByText(/análisis exploratorio/i)).toBeInTheDocument()
  })

  it('renders the per-surveyor QC card (para-data) for an investigador', () => {
    useStore.setState({
      userRole: 'investigador',
      surveys: [
        // 60s interview → flagged as too fast
        mkSurvey('a', { nuiEtr: 42, createdAt: '2026-01-01T00:02:00.000Z', startedAt: '2026-01-01T00:01:00.000Z' }),
        mkSurvey('b', { nuiEtr: 42, createdAt: '2026-01-01T00:12:00.000Z', startedAt: '2026-01-01T00:01:00.000Z' }),
      ],
    })
    render(<DashboardPage />)
    expect(screen.getByText(/Control de calidad por encuestador/i)).toBeInTheDocument()
    expect(screen.getByText(/#42/)).toBeInTheDocument()
  })

  it('renders the per-product medication analytics when surveys carry medications', () => {
    useStore.setState({
      userRole: 'investigador',
      surveys: [
        mkSurvey('a', {
          medications: [
            { nmMed: 'Dolex', dci: 'Acetaminofén', concMed: 500, undConc: 'mg', fVto: '2020-01-01' },
            { nmMed: 'Advil', dci: 'Ibuprofeno', concMed: 400, undConc: 'mg', fVto: '2030-01-01' },
          ],
        } as Partial<Survey>),
      ],
    })
    render(<DashboardPage />)
    expect(screen.getByText(/Analítica de medicamentos/i)).toBeInTheDocument()
    // Plain-DOM KPIs (Recharts axes don't render under jsdom's zero-width layout).
    expect(screen.getByText('Princ. activos')).toBeInTheDocument()
  })

  it('renders the motives card scoped to v2 records (not asked v1 excluded)', () => {
    useStore.setState({
      userRole: 'investigador',
      surveys: [
        // v2, asked the battery
        mkSurvey('a', { instrumentVersion: 2, medSob: 'Sí', motNoConsumo: ['Sobró de la dosis'], dispFinal: ['Basura'], conocePuntos: 'No' } as Partial<Survey>),
        // v1, battery not in the instrument → must not count toward the base
        mkSurvey('b', { medSob: 'Sí' }),
      ],
    })
    render(<DashboardPage />)
    expect(screen.getByText(/Motivos de acumulación y disposición/i)).toBeInTheDocument()
    // Base text (count is in a separate <strong>, so match the surrounding node)
    // and the v1 record is reported separately as "not asked".
    expect(screen.getByText(/del instrumento v2 con medicamentos/i)).toBeInTheDocument()
    expect(screen.getByText(/no incluyen estas preguntas/i)).toBeInTheDocument()
  })

  it('renders the back-check agreement card when a re-interview exists', () => {
    useStore.setState({
      userRole: 'investigador',
      surveys: [
        mkSurvey('orig', { vtoMedNc: 'Sí', medSob: 'Sí' }),
        // back-check of 'orig' with one disagreement (medSob No vs Sí)
        mkSurvey('bc', { backcheckOf: 'orig', vtoMedNc: 'Sí', medSob: 'No' }),
      ],
    })
    render(<DashboardPage />)
    expect(screen.getByText(/Concordancia de back-check/i)).toBeInTheDocument()
    expect(screen.getByText(/κ ítems Sí\/No/)).toBeInTheDocument()
  })
})
