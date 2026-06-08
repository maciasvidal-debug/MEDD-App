// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AjustesPage, ExportarPage, BuscarPage } from './index'
import { useStore } from '../lib/store'
import { DEFAULT_SETTINGS } from '../lib/constants'
import type { User } from '@supabase/supabase-js'

// These pages pull in the store, which builds the Supabase client at module
// load; stub it so the import doesn't need env vars.
vi.mock('../lib/supabase', () => ({ supabase: {} }))

beforeEach(() => {
  useStore.setState({
    user: { id: 'u', email: 'field@medd.co' } as unknown as User,
    settings: DEFAULT_SETTINGS, settingsLoaded: true,
    surveys: [], wizard: null, view: 'ajustes', toasts: [], syncing: false,
  })
})

describe('AjustesPage — role-aware settings', () => {
  it('hides the surveyor profile + project config for an investigador', () => {
    useStore.setState({ userRole: 'investigador' })
    render(<AjustesPage />)
    // The surveyor-specific sections must not be shown to a read-only analyst.
    expect(screen.queryByText('Perfil del encuestador')).not.toBeInTheDocument()
    expect(screen.queryByText('Configuración del proyecto')).not.toBeInTheDocument()
    // The shared sections still render.
    expect(screen.getByText(/Tema (claro|oscuro)/)).toBeInTheDocument()
    expect(screen.getByText('Investigador')).toBeInTheDocument()
  })

  it('shows the surveyor profile + project config for an encuestador', () => {
    useStore.setState({ userRole: 'encuestador' })
    render(<AjustesPage />)
    expect(screen.getByText('Perfil del encuestador')).toBeInTheDocument()
    expect(screen.getByText('Configuración del proyecto')).toBeInTheDocument()
  })
})

describe('page smoke renders', () => {
  it('ExportarPage renders and disables exports with no data', () => {
    useStore.setState({ userRole: 'encuestador', surveys: [] })
    render(<ExportarPage />)
    expect(screen.getByText('Exportar datos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar \.csv/ })).toBeDisabled()
  })

  it('BuscarPage renders the CUM search input', () => {
    useStore.setState({ userRole: 'encuestador' })
    render(<BuscarPage />)
    expect(screen.getByText('Buscador CUM-INVIMA')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Nombre comercial/)).toBeInTheDocument()
  })
})
