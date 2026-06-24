import { useEffect, useRef } from 'react'

/**
 * Just-in-time focus/scroll for conditionally-revealed form blocks. Attach the
 * returned ref to a block (or input) that mounts when `active` flips true: on
 * that transition it scrolls into view, and — when `autofocus` is set — moves
 * focus to the first field inside, so the surveyor sees and lands on exactly the
 * field the previous answer triggered. No-op while `active` stays the same.
 */
export function useFocusOnReveal<T extends HTMLElement>(active: boolean, autofocus = false) {
  const ref = useRef<T | null>(null)
  const prev = useRef(active)

  useEffect(() => {
    if (active && !prev.current && ref.current) {
      const el = ref.current
      // jsdom (tests) throws on scrollIntoView — guard so it never breaks render.
      try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } catch { /* noop */ }
      if (autofocus) {
        const target = el.matches('input, select, textarea')
          ? el
          : el.querySelector<HTMLElement>('input, select, textarea')
        target?.focus({ preventScroll: true })
      }
    }
    prev.current = active
  }, [active, autofocus])

  return ref
}
