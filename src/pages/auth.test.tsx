// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthPage from './auth'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn()
    }
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthPage error handling', () => {
  it('successfully logs in without errors (happy path)', async () => {
    const user = userEvent.setup()

    // Setup mock for successful login
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: { id: '1' }, session: { access_token: '123' } },
      error: null
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)

    render(<AuthPage />)

    const emailInput = screen.getByRole('textbox', { name: /correo electrónico/i })
    const passwordInput = screen.getByLabelText('Contraseña', { exact: true })
    const submitBtn = screen.getByRole('button', { name: /ingresar/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitBtn)

    await waitFor(() => expect(submitBtn).not.toBeDisabled())

    // No error messages should be displayed
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows API error when Supabase returns an error object', async () => {
    const user = userEvent.setup()

    // Setup mock for API error
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', name: 'AuthError', status: 400 }
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)

    render(<AuthPage />)

    const emailInput = screen.getByRole('textbox', { name: /correo electrónico/i })
    const passwordInput = screen.getByLabelText('Contraseña', { exact: true })
    const submitBtn = screen.getByRole('button', { name: /ingresar/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitBtn)

    await waitFor(() => expect(submitBtn).not.toBeDisabled())

    // Should display the specific API error message
    expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
  })

  it('shows generic error on network failure (thrown exception)', async () => {
    const user = userEvent.setup()

    // Setup mock to throw an error (simulating network failure)
    vi.mocked(supabase.auth.signInWithPassword).mockRejectedValueOnce(new Error('Network error'))

    render(<AuthPage />)

    const emailInput = screen.getByRole('textbox', { name: /correo electrónico/i })
    const passwordInput = screen.getByLabelText('Contraseña', { exact: true })
    const submitBtn = screen.getByRole('button', { name: /ingresar/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitBtn)

    await waitFor(() => expect(submitBtn).not.toBeDisabled())

    // It should display the generic try/catch error message
    expect(screen.getByText('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')).toBeInTheDocument()
  })
})
