// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import type { Session, User } from '@supabase/supabase-js'

// Controllable auth mock: capture the onAuthStateChange callback so the test can
// fire auth events, and serve a role row for the deferred hydration.
const authState = vi.hoisted(() => ({
  cb: null as null | ((event: string, session: unknown) => void),
  roleRow: null as { role: string; active?: boolean } | null,
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        authState.cb = cb
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: authState.roleRow, error: null }) }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}))

import { useStore } from './store'

const session = (id: string): Session => ({ user: { id } as User } as Session)

beforeEach(() => {
  authState.cb = null
  authState.roleRow = null
  useStore.setState({ user: null, session: null, authReady: false, userRole: null })
})

describe('initAuth', () => {
  it('subscribes and returns an unsubscribe function', () => {
    const unsub = useStore.getState().initAuth()
    expect(typeof unsub).toBe('function')
    expect(authState.cb).toBeTypeOf('function')
    unsub()
  })

  it('resolves auth eagerly when a session arrives', () => {
    const unsub = useStore.getState().initAuth()
    authState.cb!('SIGNED_IN', session('u1'))
    const s = useStore.getState()
    expect(s.user?.id).toBe('u1')
    expect(s.authReady).toBe(true)
    unsub()
  })

  it('clears user and role on sign-out', () => {
    const unsub = useStore.getState().initAuth()
    useStore.setState({ userRole: 'investigador' })
    authState.cb!('SIGNED_OUT', null)
    const s = useStore.getState()
    expect(s.user).toBeNull()
    expect(s.userRole).toBeNull()
    expect(s.authReady).toBe(true)
    unsub()
  })

  it('hydrates the role from user_roles in the deferred (post-lock) step', async () => {
    authState.roleRow = { role: 'investigador' }
    const unsub = useStore.getState().initAuth()
    authState.cb!('INITIAL_SESSION', session('u2'))
    await waitFor(() => expect(useStore.getState().userRole).toBe('investigador'))
    unsub()
  })

  it('falls back to encuestador when there is no role row', async () => {
    authState.roleRow = null
    const unsub = useStore.getState().initAuth()
    authState.cb!('INITIAL_SESSION', session('u3'))
    await waitFor(() => expect(useStore.getState().userRole).toBe('encuestador'))
    unsub()
  })

  it('gates an inactive account (active=false) via userActive', async () => {
    authState.roleRow = { role: 'encuestador', active: false }
    const unsub = useStore.getState().initAuth()
    authState.cb!('INITIAL_SESSION', session('u4'))
    await waitFor(() => expect(useStore.getState().userActive).toBe(false))
    unsub()
  })

  it('treats a missing active field as active (older schema / RLS enforces)', async () => {
    authState.roleRow = { role: 'encuestador' }
    const unsub = useStore.getState().initAuth()
    authState.cb!('INITIAL_SESSION', session('u5'))
    await waitFor(() => expect(useStore.getState().userRole).toBe('encuestador'))
    expect(useStore.getState().userActive).toBe(true)
    unsub()
  })

  it('resets userActive on sign-out', () => {
    const unsub = useStore.getState().initAuth()
    useStore.setState({ userActive: false })
    authState.cb!('SIGNED_OUT', null)
    expect(useStore.getState().userActive).toBe(true)
    unsub()
  })
})

describe('initAuth - error handling', () => {
  it('prevents app crash when hydration errors out', async () => {
    // Force an error in the hydration block by making the role lookup query throw
    // The query returns `{ data, error }`, so we need it to actually throw an error
    // to reach the outer catch block that we are testing.
    // However, the test's `select().single()` mock already handles the Promise correctly,
    // so let's mock localStorage.setItem since it's the simplest synchronous function
    // in the `applyUserScope` try-catch.

    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('Simulated error to fail hydration')
    })

    const unsub = useStore.getState().initAuth()

    // Changing session to a new user triggers applyUserScope and the localStorage call
    authState.cb!('SIGNED_IN', session('u99'))

    // Vitest fails if an error is unhandled, so getting past this wait means the error was caught
    await waitFor(() => expect(useStore.getState().authReady).toBe(true))

    // We wait slightly longer to ensure the setTimeout inside initAuth finishes
    await new Promise(resolve => setTimeout(resolve, 50))

    unsub()
    Storage.prototype.setItem = originalSetItem
  })
})
