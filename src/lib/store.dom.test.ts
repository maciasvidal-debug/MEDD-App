// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

// The store imports supabase at module load; theme/density/welcome never touch
// it, so a minimal stub is enough.
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}))

import { useStore } from './store'

const fakeUser = { id: 'u1' } as unknown as User

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ user: fakeUser, welcomeOpen: false })
})

describe('toggleTheme', () => {
  it('flips the theme, persists it and reflects it on <html data-theme>', () => {
    const start = useStore.getState().theme
    useStore.getState().toggleTheme()
    const next = useStore.getState().theme
    expect(next).not.toBe(start)
    expect(document.documentElement.getAttribute('data-theme')).toBe(next)
    expect(localStorage.getItem('medd_theme')).toBe(next)
  })
})

describe('setDensity', () => {
  it('persists the density and reflects it on <html data-density>', () => {
    useStore.getState().setDensity('compact')
    expect(useStore.getState().density).toBe('compact')
    expect(document.documentElement.getAttribute('data-density')).toBe('compact')
    expect(localStorage.getItem('medd_density')).toBe('compact')
  })
})

describe('welcome tour (per-user)', () => {
  it('opens once for a new user, then stays closed once dismissed', () => {
    useStore.getState().maybeOpenWelcome()
    expect(useStore.getState().welcomeOpen).toBe(true)

    useStore.getState().closeWelcome() // marks seen for u1
    expect(useStore.getState().welcomeOpen).toBe(false)

    useStore.getState().maybeOpenWelcome() // already seen → no auto-open
    expect(useStore.getState().welcomeOpen).toBe(false)
  })

  it('openWelcome forces it open even after it has been seen', () => {
    useStore.getState().closeWelcome()
    useStore.getState().openWelcome()
    expect(useStore.getState().welcomeOpen).toBe(true)
  })

  it('re-opens automatically for a different user that has not seen it', () => {
    useStore.getState().closeWelcome() // u1 seen
    useStore.setState({ user: { id: 'u2' } as unknown as User, welcomeOpen: false })
    useStore.getState().maybeOpenWelcome()
    expect(useStore.getState().welcomeOpen).toBe(true)
  })
})
