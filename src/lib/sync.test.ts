import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Controllable fake of the remote (Supabase) side, shared with the mock below.
const state = vi.hoisted(() => ({
  remoteRows: [] as Record<string, unknown>[],
  pushError: null as { message: string } | null,
  deleteFailIds: new Set<string>(),
  deleted: [] as string[],
  pushed: [] as Record<string, unknown>[],
}))

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      upsert: (rowOrRows: Record<string, unknown> | Record<string, unknown>[]) => {
        if (Array.isArray(rowOrRows)) {
          state.pushed.push(...rowOrRows)
        } else {
          state.pushed.push(rowOrRows)
        }
        return Promise.resolve({ error: state.pushError })
      },
      delete: () => ({
        eq: (_col: string, id: string) => {
          state.deleted.push(id)
          return Promise.resolve({ error: state.deleteFailIds.has(id) ? { message: 'net' } : null })
        },
        in: (_col: string, ids: string[]) => {
          state.deleted.push(...ids)
          // Bulk delete is atomic: the whole call fails if any id can't be deleted.
          const failed = ids.some(id => state.deleteFailIds.has(id))
          return Promise.resolve({ error: failed ? { message: 'net' } : null })
        },
      }),
      select: () => ({
        order: () => Promise.resolve({ data: state.remoteRows, error: null }),
      }),
    }),
  },
}))

import { fullSync } from './sync'
import { toRow } from './sync-mapping'
import { saveSurvey, getSurvey, addDeletion, getDeletionIds, clearLocalUserData } from './db'
import type { Survey } from '../types'

const mkSurvey = (id: string, over: Partial<Survey> = {}): Survey => ({
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nui: 1,
  ciudad: 'X',
  medications: [],
  syncStatus: 'local',
  ...over,
}) as unknown as Survey

const remote = (s: Survey) => toRow(s, 'owner')

beforeEach(async () => {
  state.remoteRows = []
  state.pushError = null
  state.deleteFailIds = new Set()
  state.deleted = []
  state.pushed = []
  await clearLocalUserData()
})

describe('fullSync — pull & last-write-wins merge', () => {
  it('adds remote-only surveys and updates ones with a newer remote timestamp', async () => {
    await saveSurvey(mkSurvey('A', { updatedAt: '2026-01-01T00:00:00.000Z', ciudad: 'Old' }))
    state.remoteRows = [
      remote(mkSurvey('A', { updatedAt: '2026-02-01T00:00:00.000Z', ciudad: 'New' })),
      remote(mkSurvey('B', { updatedAt: '2026-01-15T00:00:00.000Z' })),
    ]

    const res = await fullSync('owner', 'investigador')

    expect(res.pulled).toBe(2)
    expect((await getSurvey('A'))!.ciudad).toBe('New')
    expect(await getSurvey('B')).toBeTruthy()
  })

  it('does NOT overwrite a survey that is newer locally', async () => {
    await saveSurvey(mkSurvey('A', { updatedAt: '2026-03-01T00:00:00.000Z', ciudad: 'Local' }))
    state.remoteRows = [remote(mkSurvey('A', { updatedAt: '2026-01-01T00:00:00.000Z', ciudad: 'Remote' }))]

    await fullSync('owner', 'investigador')

    expect((await getSurvey('A'))!.ciudad).toBe('Local')
  })
})

describe('fullSync — deletion tombstones', () => {
  it('retries the remote delete and clears the tombstone on success', async () => {
    await addDeletion('D')

    await fullSync('owner', 'encuestador')

    expect(state.deleted).toContain('D')
    expect(await getDeletionIds()).toEqual([])
  })

  it('keeps the tombstone AND skips resurrection when the remote delete fails', async () => {
    await addDeletion('E')
    state.deleteFailIds = new Set(['E'])
    state.remoteRows = [remote(mkSurvey('E'))] // server still returns the row

    const res = await fullSync('owner', 'investigador')

    expect(state.deleted).toContain('E')          // retry attempted
    expect(await getSurvey('E')).toBeUndefined()   // not resurrected locally
    expect(await getDeletionIds()).toContain('E')  // kept for the next retry
    expect(res.pulled).toBe(0)
  })
})

describe('fullSync — push (encuestador)', () => {
  it('pushes local surveys and marks them synced', async () => {
    await saveSurvey(mkSurvey('F', { syncStatus: 'local' }))

    const res = await fullSync('owner', 'encuestador')

    expect(res.pushed).toBe(1)
    expect(state.pushed.some(r => r.id === 'F')).toBe(true)
    expect((await getSurvey('F'))!.syncStatus).toBe('synced')
  })
})
