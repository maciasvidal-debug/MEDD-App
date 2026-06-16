import { describe, it, expect, beforeEach, vi } from 'vitest'

// Tailored Supabase fake for the individual remote helpers (the fullSync
// orchestration is covered separately in sync.test.ts). Each flag drives one
// branch — happy path, `{ error }` result, or a thrown/rejected fetch — so we
// can assert the non-throwing sentinel contract documented in sync.ts.
const state = vi.hoisted(() => ({
  profileData:  null as Record<string, unknown> | null,
  profileError: null as { message: string } | null,
  upsertError:  null as { message: string } | null,
  upsertThrow:  false,
  deleteError:  null as { message: string } | null,
  deleteThrow:  false,
  pullData:     [] as Record<string, unknown>[] | null,
  pullError:    null as { message: string } | null,
  pullThrow:    false,
  lastUpsert:   null as Record<string, unknown> | null,
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: state.profileData, error: state.profileError }),
        order: () =>
          state.pullThrow
            ? Promise.reject(new Error('network'))
            : Promise.resolve({ data: state.pullData, error: state.pullError }),
      }),
      upsert: (rowOrRows: Record<string, unknown> | Record<string, unknown>[]) => {
        if (state.upsertThrow) throw new Error('network')
        if (Array.isArray(rowOrRows)) {
          state.lastUpsert = rowOrRows[rowOrRows.length - 1] || null
        } else {
          state.lastUpsert = rowOrRows
        }
        return Promise.resolve({ error: state.upsertError })
      },
      delete: () => ({
        eq: () =>
          state.deleteThrow
            ? Promise.reject(new Error('network'))
            : Promise.resolve({ error: state.deleteError }),
      }),
    }),
  },
}))

import { fetchProfile, upsertProfile, pushSurvey, deleteSurveyRemote, pullSurveys } from './sync'
import { toRow } from './sync-mapping'
import { DEFAULT_SETTINGS } from './constants'
import type { Settings, Survey } from '../types'

const mkSurvey = (id: string, over: Partial<Survey> = {}): Survey => ({
  id, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  nui: 1, ciudad: 'X', medications: [], syncStatus: 'local', ...over,
}) as unknown as Survey

beforeEach(() => {
  Object.assign(state, {
    profileData: null, profileError: null,
    upsertError: null, upsertThrow: false,
    deleteError: null, deleteThrow: false,
    pullData: [], pullError: null, pullThrow: false,
    lastUpsert: null,
  })
})

describe('fetchProfile', () => {
  it('maps a remote row (snake_case → camelCase, semestre → string)', async () => {
    state.profileData = {
      nui_encuestador: '77', etr_programa: 'Medicina', etr_tipo_inst: 'Pública',
      etr_semestre: 8, etr_institucion: 'UNAL',
    }
    expect(await fetchProfile()).toEqual({
      nuiEncuestador: '77', etrPrograma: 'Medicina', etrTipoInst: 'Pública',
      etrSemestre: '8', etrInstitucion: 'UNAL',
    })
  })

  it('coerces null columns to empty strings', async () => {
    state.profileData = {
      nui_encuestador: null, etr_programa: null, etr_tipo_inst: null,
      etr_semestre: null, etr_institucion: null,
    }
    expect(await fetchProfile()).toEqual({
      nuiEncuestador: '', etrPrograma: '', etrTipoInst: '', etrSemestre: '', etrInstitucion: '',
    })
  })

  it('returns null when there is no row or an error', async () => {
    expect(await fetchProfile()).toBeNull() // profileData null
    state.profileError = { message: 'boom' }
    expect(await fetchProfile()).toBeNull()
  })
})

describe('upsertProfile', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS, nuiEncuestador: '77', etrPrograma: 'Medicina',
    etrTipoInst: 'Pública', etrSemestre: '8', etrInstitucion: 'UNAL',
  }

  it('parses semestre to an int and stamps the user_id', async () => {
    expect(await upsertProfile('owner', settings)).toBe(true)
    expect(state.lastUpsert).toMatchObject({ user_id: 'owner', etr_semestre: 8, nui_encuestador: '77' })
  })

  it('maps empty optional fields and a blank semestre to null', async () => {
    await upsertProfile('owner', { ...settings, etrSemestre: '', etrInstitucion: '' })
    expect(state.lastUpsert).toMatchObject({ etr_semestre: null, etr_institucion: null })
  })

  it('returns false on an error result or a thrown fetch', async () => {
    state.upsertError = { message: 'rls' }
    expect(await upsertProfile('owner', settings)).toBe(false)
    state.upsertError = null
    state.upsertThrow = true
    expect(await upsertProfile('owner', settings)).toBe(false)
  })
})

describe('pushSurvey', () => {
  it('returns true on success and false on error/throw', async () => {
    expect(await pushSurvey(mkSurvey('A'), 'owner')).toBe(true)
    expect(state.lastUpsert).toMatchObject({ id: 'A', user_id: 'owner' })
    state.upsertError = { message: 'net' }
    expect(await pushSurvey(mkSurvey('A'), 'owner')).toBe(false)
    state.upsertError = null
    state.upsertThrow = true
    expect(await pushSurvey(mkSurvey('A'), 'owner')).toBe(false)
  })
})

describe('deleteSurveyRemote', () => {
  it('returns true on success and false on error/throw', async () => {
    expect(await deleteSurveyRemote('A')).toBe(true)
    state.deleteError = { message: 'net' }
    expect(await deleteSurveyRemote('A')).toBe(false)
    state.deleteError = null
    state.deleteThrow = true
    expect(await deleteSurveyRemote('A')).toBe(false)
  })
})

describe('pullSurveys', () => {
  it('maps remote rows through fromRow', async () => {
    state.pullData = [toRow(mkSurvey('A', { ciudad: 'Cali' }), 'owner')]
    const out = await pullSurveys()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'A', ciudad: 'Cali', syncStatus: 'synced' })
  })

  it('returns [] on error, null data, or a thrown fetch', async () => {
    state.pullError = { message: 'boom' }
    expect(await pullSurveys()).toEqual([])
    state.pullError = null
    state.pullData = null
    expect(await pullSurveys()).toEqual([])
    state.pullData = []
    state.pullThrow = true
    expect(await pullSurveys()).toEqual([])
  })
})

describe('pushSurveys', () => {
  it('returns true on success and false on error/throw', async () => {
    const { pushSurveys } = await import('./sync')
    expect(await pushSurveys([mkSurvey('A'), mkSurvey('B')], 'owner')).toBe(true)
    expect(state.lastUpsert).toMatchObject({ id: 'B', user_id: 'owner' })
    state.upsertError = { message: 'net' }
    expect(await pushSurveys([mkSurvey('A')], 'owner')).toBe(false)
    state.upsertError = null
    state.upsertThrow = true
    expect(await pushSurveys([mkSurvey('A')], 'owner')).toBe(false)
  })
  it('returns true immediately if surveys array is empty', async () => {
    const { pushSurveys } = await import('./sync')
    expect(await pushSurveys([], 'owner')).toBe(true)
  })
})
