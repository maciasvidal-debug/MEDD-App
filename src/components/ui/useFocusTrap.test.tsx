// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

// A wrapper component to test the hook
function FocusTrapComponent({ onEscape }: { onEscape?: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, onEscape)

  return (
    <div ref={panelRef} tabIndex={-1} data-testid="panel">
      <button data-testid="btn-1">Button 1</button>
      <button data-testid="btn-2">Button 2</button>
      <button data-testid="btn-3">Button 3</button>
    </div>
  )
}

function EmptyFocusTrapComponent() {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef)

  return (
    <div ref={panelRef} tabIndex={-1} data-testid="empty-panel">
      <p>No focusable elements here.</p>
    </div>
  )
}

function App({ onEscape }: { onEscape?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div>
      <button data-testid="trigger" onClick={() => setIsOpen(true)}>
        Open Modal
      </button>
      {isOpen && <FocusTrapComponent onEscape={onEscape} />}
      <button data-testid="close" onClick={() => setIsOpen(false)}>
        Close Modal
      </button>
    </div>
  )
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    // Reset body style before each test
    document.body.style.overflow = ''
    document.body.innerHTML = ''
  })

  it('locks scroll on mount and restores on unmount', async () => {
    const user = userEvent.setup()

    // Initial overflow should be empty
    expect(document.body.style.overflow).toBe('')

    render(<App />)

    // Open modal
    await user.click(screen.getByTestId('trigger'))
    expect(document.body.style.overflow).toBe('hidden')

    // Close modal
    await user.click(screen.getByTestId('close'))
    expect(document.body.style.overflow).toBe('')
  })

  it('moves focus to the panel when opened', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTestId('trigger'))

    const panel = screen.getByTestId('panel')
    expect(document.activeElement).toBe(panel)
  })

  it('restores focus to the previously focused element on unmount', async () => {
    const user = userEvent.setup()
    render(<App />)

    const triggerBtn = screen.getByTestId('trigger')
    triggerBtn.focus()
    expect(document.activeElement).toBe(triggerBtn)

    await user.click(triggerBtn)

    // Focus should move to panel
    expect(document.activeElement).toBe(screen.getByTestId('panel'))

    // Close modal
    await user.click(screen.getByTestId('close'))

    // Focus should be restored
    expect(document.activeElement).toBe(triggerBtn)
  })

  it('traps focus using Tab and Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByTestId('trigger'))
    expect(document.activeElement).toBe(screen.getByTestId('panel'))

    const btn1 = screen.getByTestId('btn-1')
    const btn2 = screen.getByTestId('btn-2')
    const btn3 = screen.getByTestId('btn-3')

    // Tab moves to first focusable
    await user.tab()
    expect(document.activeElement).toBe(btn1)

    // Tab again
    await user.tab()
    expect(document.activeElement).toBe(btn2)

    // Tab again
    await user.tab()
    expect(document.activeElement).toBe(btn3)

    // Tab from last element wraps to first
    await user.tab()
    expect(document.activeElement).toBe(btn1)

    // Shift+Tab from first element wraps to last
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(btn3)
  })

  it('calls onEscape when Escape key is pressed', async () => {
    const user = userEvent.setup()
    const handleEscape = vi.fn()
    render(<App onEscape={handleEscape} />)

    await user.click(screen.getByTestId('trigger'))
    expect(handleEscape).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(handleEscape).toHaveBeenCalledTimes(1)
  })

  it('handles empty focus trap gracefully when Tab is pressed', async () => {
    const user = userEvent.setup()
    render(<EmptyFocusTrapComponent />)

    const panel = screen.getByTestId('empty-panel')
    expect(document.activeElement).toBe(panel)

    // Tab should not crash, it will preventDefault
    await user.tab()
    // It prevents default so focus should technically not change
    expect(document.activeElement).toBe(panel)
  })
})
