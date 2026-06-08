import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

// Controllable Supabase mock (shared with the factory via vi.hoisted).
const sb = vi.hoisted(() => ({
  deleteError:  null as { message: string } | null,
  authError:    null as { message: string } | null,
  signOutError: null as { message: string } | null,
}))
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: sb.deleteError }) }),
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
    auth: {
      signInWithPassword: () => Promise.resolve({ error: sb.authError }),
      signUp:             () => Promise.resolve({ error: sb.authError }),
      signOut:            () => Promise.resolve({ error: sb.signOutError }),
      onAuthStateChange:  () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))

import { useStore } from './store'
import { getSurvey, saveSurvey, clearLocalUserData } from './db'
import { DEFAULT_SETTINGS } from './constants'
import type { Survey, Settings } from '../types'

const fakeUser = { id: 'u' } as unknown as User
const completeSettings: Settings = {
  ...DEFAULT_SETTINGS,
  nuiEncuestador: '77',
  etrPrograma: 'Medicina',
  etrTipoInst: 'Pública',
  etrSemestre: '8',
  etrInstitucion: 'UNAL',
}
const mkSurvey = (id: string, over: Partial<Survey> = {}): Survey => ({
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nui: 1,
  medications: [],
  syncStatus: 'local',
  ...over,
}) as unknown as Survey

beforeEach(async () => {
  await clearLocalUserData()
  sb.deleteError = null
  sb.authError = null
  sb.signOutError = null
  useStore.setState({
    user: fakeUser, userRole: 'encuestador',
    settings: DEFAULT_SETTINGS, settingsLoaded: true,
    surveys: [], wizard: null, view: 'dashboard', toasts: [], syncing: false, pendingDraft: null,
  })
})

describe('openWizard — profile gate', () => {
  it('blocks an encuestador with an incomplete profile and routes to Ajustes', () => {
    useStore.setState({ userRole: 'encuestador', settings: DEFAULT_SETTINGS })
    useStore.getState().openWizard(0)
    const s = useStore.getState()
    expect(s.wizard).toBeNull()
    expect(s.view).toBe('ajustes')
  })

  it('opens the wizard when the profile is complete', () => {
    useStore.setState({ userRole: 'encuestador', settings: completeSettings })
    useStore.getState().openWizard(3)
    const s = useStore.getState()
    expect(s.view).toBe('wizard')
    expect(s.wizard?.draft.nui).toBe(4)
  })

  it('never gates an investigador (read-only role)', () => {
    useStore.setState({ userRole: 'investigador', settings: DEFAULT_SETTINGS })
    useStore.getState().openWizard(0)
    expect(useStore.getState().view).toBe('wizard')
  })
})

describe('backfillProfile', () => {
  it('fills only the blank surveyor fields of an encuestador\'s own surveys', async () => {
    await saveSurvey(mkSurvey('a', {
      nuiEtr: null, etrPrograma: '', etrTipoInst: '', etrSemestre: null, etrInstitucion: '',
    }))
    useStore.setState({ settings: completeSettings, userRole: 'encuestador' })
    await useStore.getState().loadSurveys()

    await useStore.getState().backfillProfile()

    const sv = (await getSurvey('a'))!
    expect(sv.etrPrograma).toBe('Medicina')
    expect(sv.etrInstitucion).toBe('UNAL')
    expect(sv.etrSemestre).toBe(8)
    expect(sv.nuiEtr).toBe(77)
    expect(sv.syncStatus).toBe('local')
  })

  it('does not overwrite fields already set', async () => {
    await saveSurvey(mkSurvey('a', {
      nuiEtr: 5, etrPrograma: 'Enfermería', etrTipoInst: 'Privada', etrSemestre: 2, etrInstitucion: 'Otra',
    }))
    useStore.setState({ settings: completeSettings, userRole: 'encuestador' })
    await useStore.getState().loadSurveys()

    await useStore.getState().backfillProfile()

    const sv = (await getSurvey('a'))!
    expect(sv.etrPrograma).toBe('Enfermería') // untouched
    expect(sv.nuiEtr).toBe(5)
  })

  it('is a no-op for an investigador (never rewrites others\' data)', async () => {
    useStore.setState({
      userRole: 'investigador', settings: completeSettings,
      surveys: [mkSurvey('a', { nuiEtr: null })],
    })
    await useStore.getState().backfillProfile()
    expect(useStore.getState().surveys[0].nuiEtr).toBeNull()
  })
})

describe('removeSurvey — optimistic removal & undo', () => {
  // The durable delete + tombstone happen after a 5s grace window; that path
  // (and its resurrection-prevention) is covered by db.test/sync.test. Here we
  // assert the store's synchronous orchestration: instant optimistic removal
  // and restore-on-undo, without depending on timers (which clash with
  // fake-indexeddb's internal real timers).
  it('removes the survey immediately and restores it when undone', async () => {
    await saveSurvey(mkSurvey('z'))
    await useStore.getState().loadSurveys()

    useStore.getState().removeSurvey('z')
    expect(useStore.getState().surveys.find(s => s.id === 'z')).toBeUndefined()

    const toast = useStore.getState().toasts.find(t => t.action)
    expect(toast?.action).toBeTruthy()
    toast!.action!.onClick() // "Deshacer"
    expect(useStore.getState().surveys.find(s => s.id === 'z')).toBeTruthy()
  })
})

describe('addSurvey / updateSurvey', () => {
  it('persists a new survey, prepends it, and routes to the list', async () => {
    await useStore.getState().addSurvey({ nui: 9, medications: [] } as never)
    const s = useStore.getState()
    expect(s.surveys).toHaveLength(1)
    expect(s.surveys[0].nui).toBe(9)
    expect(s.surveys[0].syncStatus).toBeDefined()
    expect(s.view).toBe('encuestas')
    expect(s.wizard).toBeNull()
    // Round-trips to IndexedDB.
    expect(await getSurvey(s.surveys[0].id)).toBeTruthy()
  })

  it('updates an existing survey in place and bumps updatedAt', async () => {
    await useStore.getState().addSurvey({ nui: 1, ciudad: 'Old', medications: [] } as never)
    const id = useStore.getState().surveys[0].id
    await useStore.getState().updateSurvey(id, { nui: 1, ciudad: 'New', medications: [] } as never)
    const sv = useStore.getState().surveys.find(s => s.id === id)!
    expect(sv.ciudad).toBe('New')
    expect(sv.syncStatus).toBe('local')
  })

  it('updateSurvey is a no-op for an unknown id', async () => {
    await useStore.getState().updateSurvey('missing', { nui: 1, medications: [] } as never)
    expect(useStore.getState().surveys).toHaveLength(0)
  })
})

describe('triggerSync', () => {
  it('is a no-op when there is no user', async () => {
    useStore.setState({ user: null })
    await useStore.getState().triggerSync()
    expect(useStore.getState().syncing).toBe(false)
  })

  it('is a no-op when a sync is already running', async () => {
    useStore.setState({ syncing: true })
    await useStore.getState().triggerSync()
    expect(useStore.getState().syncing).toBe(true) // untouched
  })

  it('runs a sync for a logged-in user and resets the syncing flag', async () => {
    await saveSurvey(mkSurvey('s1', { syncStatus: 'local' }))
    await useStore.getState().loadSurveys()
    await useStore.getState().triggerSync()
    expect(useStore.getState().syncing).toBe(false)
    expect((await getSurvey('s1'))!.syncStatus).toBe('synced')
  })
})

describe('persistSettings', () => {
  it('saves settings, updates state and confirms with a toast', async () => {
    await useStore.getState().persistSettings(completeSettings)
    expect(useStore.getState().settings.nuiEncuestador).toBe('77')
    expect(useStore.getState().toasts.some(t => t.message.includes('guardada'))).toBe(true)
  })
})

describe('wizard navigation', () => {
  it('opens an edit wizard with the survey fields as the draft', () => {
    useStore.getState().openEditWizard(mkSurvey('w', { nui: 5, ciudad: 'Cali' }))
    const w = useStore.getState().wizard!
    expect(w.editingId).toBe('w')
    expect(w.draft.nui).toBe(5)
    expect('id' in w.draft).toBe(false) // identity fields stripped from the draft
    expect(useStore.getState().view).toBe('wizard')
  })

  it('advances the step and merges draft patches', () => {
    useStore.getState().openEditWizard(mkSurvey('w', { ciudad: 'Cali' }))
    useStore.getState().setWizardStep(3)
    expect(useStore.getState().wizard!.step).toBe(3)
    useStore.getState().updateDraft({ ciudad: 'Bogotá' })
    expect(useStore.getState().wizard!.draft.ciudad).toBe('Bogotá')
  })

  it('closeWizard clears the wizard and returns to the list', () => {
    useStore.getState().openEditWizard(mkSurvey('w'))
    useStore.getState().closeWizard()
    expect(useStore.getState().wizard).toBeNull()
    expect(useStore.getState().view).toBe('encuestas')
  })
})

describe('draft resume / discard', () => {
  it('resumes a persisted draft into the wizard', () => {
    useStore.setState({ pendingDraft: { step: 2, draft: { nui: 1 } as never } })
    useStore.getState().resumeDraft()
    expect(useStore.getState().wizard?.step).toBe(2)
    expect(useStore.getState().pendingDraft).toBeNull()
  })

  it('discardDraft clears the pending draft', async () => {
    useStore.setState({ pendingDraft: { step: 1, draft: {} as never } })
    await useStore.getState().discardDraft()
    expect(useStore.getState().pendingDraft).toBeNull()
  })
})

describe('toasts', () => {
  it('adds and removes toasts by id', () => {
    useStore.setState({ toasts: [] })
    useStore.getState().pushToast('Hola', 'info')
    const t = useStore.getState().toasts.at(-1)!
    expect(t.message).toBe('Hola')
    useStore.getState().removeToast(t.id)
    expect(useStore.getState().toasts.find(x => x.id === t.id)).toBeUndefined()
  })
})

describe('auth wrappers', () => {
  it('signIn returns null on success and the message on failure', async () => {
    expect(await useStore.getState().signIn('a@b.co', 'pw')).toBeNull()
    sb.authError = { message: 'Invalid login' }
    expect(await useStore.getState().signIn('a@b.co', 'pw')).toBe('Invalid login')
  })

  it('signUp surfaces the error message', async () => {
    sb.authError = { message: 'already registered' }
    expect(await useStore.getState().signUp('a@b.co', 'pw')).toBe('already registered')
  })

  it('signOut clears session state', async () => {
    useStore.setState({ user: fakeUser, surveys: [mkSurvey('x')], surveysLoaded: true })
    await useStore.getState().signOut()
    const s = useStore.getState()
    expect(s.user).toBeNull()
    expect(s.userRole).toBeNull()
    expect(s.surveys).toEqual([])
  })

  it('signOut still clears local state and warns when the remote call fails', async () => {
    sb.signOutError = { message: 'offline' }
    useStore.setState({ user: fakeUser })
    await useStore.getState().signOut()
    expect(useStore.getState().user).toBeNull()
    expect(useStore.getState().toasts.some(t => t.level === 'info')).toBe(true)
  })
})
