import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

// Controllable Supabase mock (shared with the factory via vi.hoisted).
const sb = vi.hoisted(() => ({ deleteError: null as { message: string } | null }))
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: sb.deleteError }) }),
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
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
