import { openDB, type IDBPDatabase } from 'idb'
import type { Survey, Settings, WizardState } from '../types'
import { DEFAULT_SETTINGS } from './constants'

const DB_NAME    = 'medd_db'
const DB_VERSION = 4   // v2: codebook fields + 1:N meds · v3: wizard draft · v4: deletion tombstones

interface MEDDSchema {
  surveys: {
    key: string
    value: Survey
    indexes: {
      'by-fEta':   string
      'by-ciudad': string
      'by-medSob': string
    }
  }
  settings: {
    key: string
    value: Settings & { id: string }
  }
  drafts: {
    key: string
    value: WizardState & { id: string }
  }
  // Tombstones for surveys deleted locally whose remote delete hasn't been
  // confirmed yet. They let sync (a) retry the remote delete and (b) avoid
  // resurrecting the row when pulling, until the server acknowledges.
  deletions: {
    key: string
    value: { id: string; deletedAt: string }
  }
}

let _db: IDBPDatabase<MEDDSchema> | null = null

async function getDB(): Promise<IDBPDatabase<MEDDSchema>> {
  if (_db) return _db
  _db = await openDB<MEDDSchema>(DB_NAME, DB_VERSION, {
    // Migrations are gated by oldVersion so each only runs once and a later
    // bump never re-runs an earlier (destructive) step — e.g. the v1→v2
    // surveys recreation must not wipe a v2 user's local rows on the v3 bump.
    upgrade(db, oldVersion) {
      // v1 → v2: recreate surveys store with new indexes. The field schema
      // changed completely, so any pre-v2 records are incompatible.
      if (oldVersion < 2) {
        if (db.objectStoreNames.contains('surveys')) {
          db.deleteObjectStore('surveys')
        }
        const store = db.createObjectStore('surveys', { keyPath: 'id' })
        store.createIndex('by-fEta',   'fEta')
        store.createIndex('by-ciudad', 'ciudad')
        store.createIndex('by-medSob', 'medSob')

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
      }

      // v2 → v3: add the wizard-draft store (single-record, key 'current') so
      // an in-progress survey survives reloads / the tab being killed.
      if (oldVersion < 3 && !db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' })
      }

      // v3 → v4: add the deletion-tombstone store so offline deletes survive
      // until the server confirms them (prevents resurrection on the next pull).
      if (oldVersion < 4 && !db.objectStoreNames.contains('deletions')) {
        db.createObjectStore('deletions', { keyPath: 'id' })
      }
    },
  })
  return _db
}

// ─── Survey CRUD ──────────────────────────────────────────────────────────

export async function getAllSurveys(): Promise<Survey[]> {
  const db  = await getDB()
  const all = await db.getAll('surveys')
  // Invariante Rec. 1 (versionado no nulo): un registro local sin versión es un
  // histórico del instrumento v1 (capturado antes de existir el campo) → se
  // normaliza a 1 al leer, de modo que la app y el export nunca ven un nulo.
  for (const s of all) if (s.instrumentVersion == null) s.instrumentVersion = 1
  // Guard against rows with a missing createdAt (e.g. a malformed remote row):
  // calling .localeCompare on undefined would throw and break the whole load.
  return all.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

export async function getSurvey(id: string): Promise<Survey | undefined> {
  const db = await getDB()
  return db.get('surveys', id)
}

export async function saveSurvey(survey: Survey): Promise<void> {
  const db = await getDB()
  await db.put('surveys', survey)
}

export async function saveManySurveys(surveys: Survey[]): Promise<void> {
  if (surveys.length === 0) return
  const db = await getDB()
  const tx = db.transaction('surveys', 'readwrite')
  await Promise.all([...surveys.map(s => tx.store.put(s)), tx.done])
}

export async function deleteSurvey(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('surveys', id)
}

export async function clearAllSurveys(): Promise<void> {
  const db = await getDB()
  await db.clear('surveys')
}

// Wipe every user-scoped local store. Surveys/settings/drafts are not keyed by
// user, so when a different account signs in on the same device we must clear
// them — otherwise an investigator's pulled global dataset (or another
// encuestador's drafts) bleeds into the next session.
export async function clearLocalUserData(): Promise<void> {
  const db = await getDB()
  await Promise.all([
    db.clear('surveys'),
    db.clear('settings'),
    db.clear('drafts'),
    db.clear('deletions'),
  ])
}

// ─── Deletion tombstones ────────────────────────────────────────────────────

export async function addDeletion(id: string): Promise<void> {
  const db = await getDB()
  await db.put('deletions', { id, deletedAt: new Date().toISOString() })
}

export async function getDeletionIds(): Promise<string[]> {
  const db = await getDB()
  return db.getAllKeys('deletions') as Promise<string[]>
}

export async function removeDeletion(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('deletions', id)
}

// Drop many tombstones in one readwrite transaction instead of opening a
// separate transaction per id (mirrors saveManySurveys' bulk-write pattern).
export async function removeDeletions(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getDB()
  const tx = db.transaction('deletions', 'readwrite')
  await Promise.all([...ids.map(id => tx.store.delete(id)), tx.done])
}

// ─── Settings ─────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'app_settings'

export async function getSettings(): Promise<Settings> {
  const db     = await getDB()
  const record = await db.get('settings', SETTINGS_KEY)
  return record ?? DEFAULT_SETTINGS
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB()
  await db.put('settings', { ...settings, id: SETTINGS_KEY })
}

// ─── Wizard draft (resume in-progress survey) ──────────────────────────────

const DRAFT_KEY = 'current'

export async function getDraft(): Promise<WizardState | null> {
  const db  = await getDB()
  const rec = await db.get('drafts', DRAFT_KEY)
  if (!rec) return null
  return { step: rec.step, draft: rec.draft, editingId: rec.editingId }
}

export async function saveDraft(state: WizardState): Promise<void> {
  const db = await getDB()
  await db.put('drafts', { ...state, id: DRAFT_KEY })
}

export async function clearDraft(): Promise<void> {
  const db = await getDB()
  await db.delete('drafts', DRAFT_KEY)
}
