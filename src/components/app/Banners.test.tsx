// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { NetworkBanner } from './Banners'

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

beforeEach(() => {
  setOnLine(true)
})

afterEach(() => {
  setOnLine(true)
  vi.restoreAllMocks()
})

describe('NetworkBanner', () => {
  it('renders nothing when online', () => {
    setOnLine(true)
    const { container } = render(<NetworkBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the offline banner when initialized offline', () => {
    setOnLine(false)
    render(<NetworkBanner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument()
  })

  it('dynamically appears and disappears based on network events', () => {
    setOnLine(true)
    const { container } = render(<NetworkBanner />)
    expect(container).toBeEmptyDOMElement()

    // Simulate going offline
    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument()

    // Simulate returning online
    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
