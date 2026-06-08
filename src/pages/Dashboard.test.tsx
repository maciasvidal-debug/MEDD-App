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
})
