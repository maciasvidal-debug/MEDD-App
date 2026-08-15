import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveSurvey, getAllSurveys, getSurvey, deleteSurvey, saveManySurveys, clearAllSurveys,
  addDeletion, getDeletionIds, removeDeletion, removeDeletions, clearLocalUserData,
  getSettings, saveSettings, getDraft, saveDraft, clearDraft,
} from './db'
import { DEFAULT_SETTINGS } from './constants'
import type { Survey, WizardState } from '../types'

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
})

describe('db — survey CRUD', () => {
  it('saves and reads back a survey', async () => {
    await saveSurvey(mkSurvey('a'))
    expect(await getSurvey('a')).toMatchObject({ id: 'a' })
    expect(await getAllSurveys()).toHaveLength(1)
  })

  it('bulk-saves and deletes', async () => {
    await saveManySurveys([mkSurvey('a'), mkSurvey('b'), mkSurvey('c')])
    expect(await getAllSurveys()).toHaveLength(3)
    await deleteSurvey('b')
    const ids = (await getAllSurveys()).map(s => s.id).sort()
    expect(ids).toEqual(['a', 'c'])
  })

  it('saveManySurveys is a no-op for an empty array', async () => {
    await saveManySurveys([])
    expect(await getAllSurveys()).toHaveLength(0)
  })

  it('saveManySurveys propagates transaction errors', async () => {
    // Passing an object without the keyPath 'id' causes a DataError in idb
    const badSurvey = { nui: 1 } as unknown as Survey
    await expect(saveManySurveys([badSurvey])).rejects.toThrow(/Data provided to an operation does not meet requirements/)
  })

  it('clearAllSurveys removes all surveys from the store', async () => {
    await saveManySurveys([mkSurvey('a'), mkSurvey('b')])
    expect(await getAllSurveys()).toHaveLength(2)
    await clearAllSurveys()
    expect(await getAllSurveys()).toHaveLength(0)
  })

})

describe('db — deletion tombstones (v4 store)', () => {
  it('adds, lists and removes tombstones', async () => {
    await addDeletion('x')
    await addDeletion('y')
    expect((await getDeletionIds()).sort()).toEqual(['x', 'y'])
    await removeDeletion('x')
    expect(await getDeletionIds()).toEqual(['y'])
  })

  it('removeDeletions drops many tombstones in one transaction', async () => {
    await addDeletion('a')
    await addDeletion('b')
    await addDeletion('c')
    await removeDeletions(['a', 'c'])
    expect(await getDeletionIds()).toEqual(['b'])
  })

  it('removeDeletions is a no-op for an empty array', async () => {
    await addDeletion('keep')
    await removeDeletions([])
    expect(await getDeletionIds()).toEqual(['keep'])
  })
})

describe('db — clearLocalUserData', () => {
  it('wipes surveys, settings, drafts AND tombstones', async () => {
    await saveSurvey(mkSurvey('a'))
    await saveSettings({ ...DEFAULT_SETTINGS, nuiEncuestador: '99' })
    await saveDraft({ step: 2, draft: {} } as unknown as WizardState)
    await addDeletion('z')

    await clearLocalUserData()

    expect(await getAllSurveys()).toHaveLength(0)
    expect(await getDeletionIds()).toEqual([])
    expect(await getDraft()).toBeNull()
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS) // falls back to defaults
  })
})

describe('db — settings & drafts', () => {
  it('returns defaults when no settings stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips settings', async () => {
    const s = { ...DEFAULT_SETTINGS, etrInstitucion: 'UNAL' }
    await saveSettings(s)
    expect(await getSettings()).toMatchObject({ etrInstitucion: 'UNAL' })
  })

  it('saves, reads and clears a draft', async () => {
    await saveDraft({ step: 3, draft: { nui: 5 } } as unknown as WizardState)
    expect(await getDraft()).toMatchObject({ step: 3 })
    await clearDraft()
    expect(await getDraft()).toBeNull()
  })
})
