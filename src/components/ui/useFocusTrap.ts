import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

// WAI-ARIA dialog behaviour, shared by every modal so they all behave
// identically: move focus into the panel on open, trap Tab/Shift+Tab within it,
// optional Escape-to-close, lock background scroll, and restore focus to the
// previously-focused element on unmount. The panel element must be focusable
// (tabIndex={-1}). Pass no `onEscape` for a mandatory dialog that must not be
// dismissed with the keyboard (e.g. the surveyor-profile gate).
export function useFocusTrap(
  panelRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
): void {
  useEffect(() => {
    const prevFocus    = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) { e.stopPropagation(); onEscape(); return }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) { e.preventDefault(); return }
      const first = focusables[0]
      const last  = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [onEscape, panelRef])
}
