import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Survey, AppView, WizardState, Settings, SurveyDraft } from '../types'
import {
  getAllSurveys, saveSurvey, deleteSurvey,
  getSettings, saveSettings,
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { pushSurvey, deleteSurveyRemote, fullSync } from '../lib/sync'
import { uuid, todayISO } from '../lib/utils'
import { EMPTY_DRAFT, DEFAULT_SETTINGS } from '../lib/constants'

// ─── Toast ────────────────────────────────────────────────────────────────

export type ToastLevel = 'success' | 'error' | 'info'
export interface Toast { id: string; message: string; level: ToastLevel }

// ─── Store interface ──────────────────────────────────────────────────────

interface AppStore {
  // Auth
  user: User | null
  session: Session | null
  authReady: boolean
  initAuth: () => () => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>

  // Sync
  syncing: boolean
  triggerSync: () => Promise<void>

  view: AppView
  setView: (v: AppView) => void

  surveys: Survey[]
  surveysLoaded: boolean
  loadSurveys: () => Promise<void>
  addSurvey: (draft: SurveyDraft) => Promise<void>
  updateSurvey: (id: string, draft: SurveyDraft) => Promise<void>
  removeSurvey: (id: string) => Promise<void>

  wizard: WizardState | null
  openWizard: (surveyCount: number) => void
  openEditWizard: (survey: Survey) => void
  closeWizard: () => void
  setWizardStep: (step: number) => void
  updateDraft: (patch: Partial<SurveyDraft>) => void

  settings: Settings
  settingsLoaded: boolean
  loadSettings: () => Promise<void>
  persistSettings: (s: Settings) => Promise<void>

  toasts: Toast[]
  pushToast: (message: string, level?: ToastLevel) => void
  removeToast: (id: string) => void
}

// ─── Store implementation ─────────────────────────────────────────────────

export const useStore = create<AppStore>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────
  user: null,
  session: null,
  authReady: false,

  initAuth() {
    // Restore existing session
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, authReady: true })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const prev = get().user
      const next = session?.user ?? null
      set({ session, user: next })

      // First login or token refresh → sync surveys
      if (next && !prev) {
        get().loadSurveys().then(() => get().triggerSync())
      }
    })

    return () => subscription.unsubscribe()
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  async signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  },

  async signOut() {
    await supabase.auth.signOut()
    set({ user: null, session: null, surveys: [], surveysLoaded: false })
  },

  // ── Sync ─────────────────────────────────────────────────────────────
  syncing: false,

  async triggerSync() {
    const { user, syncing } = get()
    if (!user || syncing) return
    set({ syncing: true })
    try {
      const { pushed, pulled } = await fullSync(user.id)
      if (pulled > 0) {
        // Reload local surveys after pulling remote ones
        const surveys = await getAllSurveys()
        set({ surveys })
      }
      if (pushed + pulled > 0) {
        get().pushToast(`Sincronizado: ${pushed} subidas, ${pulled} descargadas`, 'info')
      }
    } catch {
      get().pushToast('Error al sincronizar. Los datos están guardados localmente.', 'error')
    } finally {
      set({ syncing: false })
    }
  },

  // ── Navigation ────────────────────────────────────────────────────────
  view: 'dashboard',
  setView: (view) => set({ view }),

  // ── Surveys ───────────────────────────────────────────────────────────
  surveys: [],
  surveysLoaded: false,

  async loadSurveys() {
    const surveys = await getAllSurveys()
    set({ surveys, surveysLoaded: true })
  },

  async addSurvey(draft) {
    const now    = new Date().toISOString()
    const survey: Survey = {
      ...draft,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
      syncStatus: 'local',
    }
    await saveSurvey(survey)
    set(s => ({ surveys: [survey, ...s.surveys] }))
    get().pushToast('Encuesta guardada correctamente')
    set({ view: 'encuestas', wizard: null })

    // Push to remote in background
    const { user } = get()
    if (user) {
      pushSurvey(survey, user.id).then(ok => {
        if (ok) saveSurvey({ ...survey, syncStatus: 'synced' })
      })
    }
  },

  async updateSurvey(id, draft) {
    const existing = get().surveys.find(s => s.id === id)
    if (!existing) return
    const updated: Survey = {
      ...existing, ...draft,
      id, createdAt: existing.createdAt, updatedAt: new Date().toISOString(),
      syncStatus: 'local',
    }
    await saveSurvey(updated)
    set(s => ({
      surveys: s.surveys.map(sv => (sv.id === id ? updated : sv)),
      view: 'encuestas',
      wizard: null,
    }))
    get().pushToast('Encuesta actualizada')

    const { user } = get()
    if (user) {
      pushSurvey(updated, user.id).then(ok => {
        if (ok) saveSurvey({ ...updated, syncStatus: 'synced' })
      })
    }
  },

  async removeSurvey(id) {
    await deleteSurvey(id)
    set(s => ({ surveys: s.surveys.filter(sv => sv.id !== id) }))
    get().pushToast('Encuesta eliminada', 'info')

    const { user } = get()
    if (user) deleteSurveyRemote(id)
  },

  // ── Wizard ────────────────────────────────────────────────────────────
  wizard: null,
  openWizard(surveyCount) {
    const { settings } = get()
    const nuiEtr = settings.nuiEncuestador ? parseInt(settings.nuiEncuestador, 10) || null : null
    const draft: SurveyDraft = {
      ...EMPTY_DRAFT,
      fEta:   todayISO(),
      nuiEtr,
      nui:    surveyCount + 1,
    }
    set({ wizard: { step: 1, draft }, view: 'wizard' })
  },
  openEditWizard(survey) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, syncStatus, ...draft } = survey
    set({ wizard: { step: 1, draft, editingId: id }, view: 'wizard' })
  },
  closeWizard() { set({ wizard: null, view: 'encuestas' }) },
  setWizardStep(step) { set(s => s.wizard ? { wizard: { ...s.wizard, step } } : {}) },
  updateDraft(patch) {
    set(s =>
      s.wizard
        ? { wizard: { ...s.wizard, draft: { ...s.wizard.draft, ...patch } } }
        : {}
    )
  },

  // ── Settings ──────────────────────────────────────────────────────────
  settings: DEFAULT_SETTINGS,
  settingsLoaded: false,
  async loadSettings() {
    const settings = await getSettings()
    set({ settings, settingsLoaded: true })
  },
  async persistSettings(settings) {
    await saveSettings(settings)
    set({ settings })
    get().pushToast('Configuración guardada')
  },

  // ── Toasts ────────────────────────────────────────────────────────────
  toasts: [],
  pushToast(message, level = 'success') {
    const id = uuid()
    set(s => ({ toasts: [...s.toasts, { id, message, level }] }))
    setTimeout(() => get().removeToast(id), 3200)
  },
  removeToast(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  },
}))
