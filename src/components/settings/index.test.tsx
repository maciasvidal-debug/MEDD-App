// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountSection } from './index'

function setup(over: Partial<Parameters<typeof AccountSection>[0]> = {}) {
  const props = {
    userEmail: 'a@b.co', isInvestigador: false, pendingCount: 0,
    syncing: false, onSync: vi.fn(), onSignOut: vi.fn(), ...over,
  }
  render(<AccountSection {...props} />)
  return props
}

describe('AccountSection', () => {
  it('shows the session email and role', () => {
    setup({ userEmail: 'field@medd.co', isInvestigador: true })
    expect(screen.getByText('field@medd.co')).toBeInTheDocument()
    expect(screen.getByText('Investigador')).toBeInTheDocument()
  })

  it('triggers a sync on demand', async () => {
    const user = userEvent.setup()
    const { onSync } = setup()
    await user.click(screen.getByRole('button', { name: /Sincronizar/ }))
    expect(onSync).toHaveBeenCalledTimes(1)
  })

  it('confirms before signing out', async () => {
    const user = userEvent.setup()
    const { onSignOut } = setup()
    // The trigger does not sign out directly — it opens a confirmation dialog.
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(onSignOut).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('warns about unsynced surveys in the confirmation message', async () => {
    const user = userEvent.setup()
    setup({ pendingCount: 3 })
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(within(screen.getByRole('dialog')).getByText(/3 encuesta/)).toBeInTheDocument()
  })
})
