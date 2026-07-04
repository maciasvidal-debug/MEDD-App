// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

// A child that throws during render, to drive the boundary into its error state.
// Returns `never` — the throw satisfies any component return type.
function Bomb({ message = 'kaboom' }: { message?: string }): never {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  let reload: ReturnType<typeof vi.fn>
  let consoleError: ReturnType<typeof vi.spyOn>
  const originalLocation = window.location

  beforeEach(() => {
    // React itself logs caught render errors to console.error; silence the noise
    // and let each test assert on the boundary's own log call explicitly.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    reload = vi.fn()
    // jsdom's window.location.reload is non-configurable, so swap the whole
    // location object for a stub (preserving the fields other code may read).
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: originalLocation.href, origin: originalLocation.origin, reload },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>contenido normal</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenido normal')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('catches a render error and shows the recovery UI instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Limpiar datos y recargar' })).toBeInTheDocument()
  })

  it('surfaces the underlying error via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <Bomb message="explota-aqui" />
      </ErrorBoundary>,
    )
    expect(consoleError).toHaveBeenCalledWith(
      'Unhandled error caught by ErrorBoundary:',
      expect.objectContaining({ message: 'explota-aqui' }),
      expect.anything(),
    )
  })

  it('reloads the page when "Recargar" is pressed', async () => {
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  describe('"Limpiar datos y recargar" — clearing local persistence', () => {
    it('wipes every IndexedDB database + localStorage, then reloads', async () => {
      const user = userEvent.setup()
      const deleteDatabase = vi.fn()
      const databases = vi.fn().mockResolvedValue([
        { name: 'medd_db' },
        { name: 'other_db' },
        { name: undefined }, // a nameless entry must be skipped, not crash
      ])
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: { databases, deleteDatabase },
      })
      const clearStorage = vi.spyOn(Storage.prototype, 'clear')

      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      await user.click(screen.getByRole('button', { name: 'Limpiar datos y recargar' }))

      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
      expect(databases).toHaveBeenCalledTimes(1)
      expect(deleteDatabase).toHaveBeenCalledWith('medd_db')
      expect(deleteDatabase).toHaveBeenCalledWith('other_db')
      // The nameless entry is guarded by `db.name && ...`, so only two deletes.
      expect(deleteDatabase).toHaveBeenCalledTimes(2)
      expect(clearStorage).toHaveBeenCalledTimes(1)
    })

    it('falls back to deleting the known db when databases() is unavailable', async () => {
      const user = userEvent.setup()
      const deleteDatabase = vi.fn()
      // Older browsers expose indexedDB but not the enumeration API.
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: { deleteDatabase },
      })
      const clearStorage = vi.spyOn(Storage.prototype, 'clear')

      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      await user.click(screen.getByRole('button', { name: 'Limpiar datos y recargar' }))

      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
      expect(deleteDatabase).toHaveBeenCalledWith('medd_db')
      expect(deleteDatabase).toHaveBeenCalledTimes(1)
      expect(clearStorage).toHaveBeenCalledTimes(1)
    })

    it('still reloads (and logs) when databases() rejects — the catch/finally path', async () => {
      const user = userEvent.setup()
      // databases() rejecting simulates IndexedDB being blocked/unavailable.
      const databases = vi.fn().mockRejectedValue(new Error('IDB unavailable'))
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: { databases, deleteDatabase: vi.fn() },
      })

      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      await user.click(screen.getByRole('button', { name: 'Limpiar datos y recargar' }))

      // The finally block must reload even though clearing failed — otherwise the
      // user is stranded on the error screen with no way out.
      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to clear local data:',
        expect.objectContaining({ message: 'IDB unavailable' }),
      )
    })

    it('still reloads (and logs) when localStorage.clear throws — the catch/finally path', async () => {
      const user = userEvent.setup()
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: { deleteDatabase: vi.fn() },
      })
      vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
        // e.g. Safari private mode / storage disabled.
        throw new Error('storage denied')
      })

      render(
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>,
      )
      await user.click(screen.getByRole('button', { name: 'Limpiar datos y recargar' }))

      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to clear local data:',
        expect.objectContaining({ message: 'storage denied' }),
      )
    })
  })
})
