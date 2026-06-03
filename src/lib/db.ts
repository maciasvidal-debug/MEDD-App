import { openDB, type IDBPDatabase } from 'idb'
import type { Survey, Settings, WizardState } from '../types'
import { DEFAULT_SETTINGS } from './constants'

const DB_NAME    = 'medd_db'
const DB_VERSION = 3   // v2: codebook fields + 1:N meds · v3: wizard draft store

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
    },
  })
  return _db
}

// ─── Survey CRUD ──────────────────────────────────────────────────────────

export async function getAllSurveys(): Promise<Survey[]> {
  const db  = await getDB()
  const all = await db.getAll('surveys')
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
  ])
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
