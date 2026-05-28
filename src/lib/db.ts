import { openDB, type IDBPDatabase } from 'idb'
import type { Survey, Settings } from '../types'
import { DEFAULT_SETTINGS } from './constants'

const DB_NAME    = 'medd_db'
const DB_VERSION = 2   // Bumped: new codebook-aligned fields + 1:N medications

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
}

let _db: IDBPDatabase<MEDDSchema> | null = null

async function getDB(): Promise<IDBPDatabase<MEDDSchema>> {
  if (_db) return _db
  _db = await openDB<MEDDSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // Version 1 → 2: recreate surveys store with new indexes.
      // Field schema changed completely; old records are incompatible.
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
    },
  })
  return _db
}

// ─── Survey CRUD ──────────────────────────────────────────────────────────

export async function getAllSurveys(): Promise<Survey[]> {
  const db  = await getDB()
  const all = await db.getAll('surveys')
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getSurvey(id: string): Promise<Survey | undefined> {
  const db = await getDB()
  return db.get('surveys', id)
}

export async function saveSurvey(survey: Survey): Promise<void> {
  const db = await getDB()
  await db.put('surveys', survey)
}

export async function deleteSurvey(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('surveys', id)
}

export async function clearAllSurveys(): Promise<void> {
  const db = await getDB()
  await db.clear('surveys')
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
