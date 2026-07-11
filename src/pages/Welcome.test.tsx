// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Welcome from './Welcome'
import { useStore } from '../lib/store'
import type { User } from '@supabase/supabase-js'

// Welcome pulls in the store, which builds the Supabase client at module load;
// stub it so the import doesn't need env vars.
vi.mock('../lib/supabase', () => ({ supabase: {} }))

beforeEach(() => {
  localStorage.clear()
  useStore.setState({
    user: { id: 'u1', email: 'field@medd.co' } as unknown as User,
    userRole: 'encuestador',
    welcomeOpen: true,
  })
})

describe('Welcome — dialog semantics', () => {
  it('renders as a labelled modal dialog', () => {
    render(<Welcome />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // The accessible name comes from the current step's heading.
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })
})

describe('Welcome — role-aware content', () => {
  it('shows the capture/offline flow for an encuestador', () => {
    useStore.setState({ userRole: 'encuestador' })
    render(<Welcome />)
    expect(screen.getByRole('heading', { name: 'Registra encuestas' })).toBeInTheDocument()
  })

  it('shows the analytics flow for an investigador', () => {
    useStore.setState({ userRole: 'investigador' })
    render(<Welcome />)
    expect(screen.getByRole('heading', { name: 'Panel analítico' })).toBeInTheDocument()
  })
})

describe('Welcome — step navigation', () => {
  it('advances and rewinds through the steps, hiding «Anterior» on the first', async () => {
    const user = userEvent.setup()
    render(<Welcome />)

    // First step: no «Anterior», a «Siguiente» rather than «Empezar».
    expect(screen.queryByRole('button', { name: /Anterior/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Empezar/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    expect(screen.getByRole('heading', { name: 'Funciona sin conexión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Anterior/ }))
    expect(screen.getByRole('heading', { name: 'Registra encuestas' })).toBeInTheDocument()
  })

  it('swaps «Siguiente» for «Empezar» on the last step', async () => {
    const user = userEvent.setup()
    render(<Welcome />)
    // Encuestador tour has 4 steps → 3 clicks to reach the last.
    for (let n = 0; n < 3; n++) await user.click(screen.getByRole('button', { name: /Siguiente/ }))

    expect(screen.getByRole('button', { name: /Empezar/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument()
  })
})

describe('Welcome — dismissal closes the tour', () => {
  it('«Empezar» on the last step closes and remembers the tour', async () => {
    const user = userEvent.setup()
    render(<Welcome />)
    for (let n = 0; n < 3; n++) await user.click(screen.getByRole('button', { name: /Siguiente/ }))
    await user.click(screen.getByRole('button', { name: /Empezar/ }))

    expect(useStore.getState().welcomeOpen).toBe(false)
    // closeWelcome persists the "seen" flag so it won't auto-open again for u1.
    expect(localStorage.getItem('medd_welcome_seen:u1')).toBe('1')
  })

  it('«Saltar» closes the tour without needing to finish it', async () => {
    const user = userEvent.setup()
    render(<Welcome />)
    await user.click(screen.getByRole('button', { name: 'Saltar introducción' }))
    expect(useStore.getState().welcomeOpen).toBe(false)
  })

  it('Escape closes the tour (focus-trap dismissal)', async () => {
    const user = userEvent.setup()
    render(<Welcome />)
    await user.keyboard('{Escape}')
    expect(useStore.getState().welcomeOpen).toBe(false)
  })
})
