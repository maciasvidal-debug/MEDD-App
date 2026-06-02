import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Survey, AppView, WizardState, Settings, SurveyDraft, UserRole } from '../types'
import {
  getAllSurveys, saveSurvey, deleteSurvey,
  getSettings, saveSettings,
  getDraft, saveDraft, clearDraft,
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { pushSurvey, deleteSurveyRemote, fullSync } from '../lib/sync'
import { uuid, todayISO } from '../lib/utils'
import { EMPTY_DRAFT, DEFAULT_SETTINGS } from '../lib/constants'

// ─── Toast ────────────────────────────────────────────────────────────────

export type ToastLevel = 'success' | 'error' | 'info'
export interface ToastAction { label: string; onClick: () => void }
export interface Toast { id: string; message: string; level: ToastLevel; action?: ToastAction }

// ─── Store interface ──────────────────────────────────────────────────────

interface AppStore {
  // Auth
  user: User | null
  session: Session | null
  authReady: boolean
  userRole: UserRole | null
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

  // Persisted draft for resuming an in-progress survey after a reload
  pendingDraft: WizardState | null
  loadDraft: () => Promise<void>
  resumeDraft: () => void
  discardDraft: () => Promise<void>

  settings: Settings
  settingsLoaded: boolean
  loadSettings: () => Promise<void>
  persistSettings: (s: Settings) => Promise<void>

  toasts: Toast[]
  pushToast: (message: string, level?: ToastLevel, action?: ToastAction, duration?: number) => void
  removeToast: (id: string) => void
}

// ─── Store implementation ─────────────────────────────────────────────────

export const useStore = create<AppStore>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────
  user: null,
  session: null,
  authReady: false,
  userRole: null,

  initAuth() {
    // Restore existing session and fetch role
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null
      let userRole: UserRole | null = null
      if (user) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        userRole = (roleRow?.role as UserRole) ?? 'encuestador'
      }
      set({ session: data.session, user, userRole, authReady: true })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const prev = get().user
      const next = session?.user ?? null

      let userRole: UserRole | null = null
      if (next) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', next.id)
          .single()
        userRole = (roleRow?.role as UserRole) ?? 'encuestador'
      }

      set({ session, user: next, userRole })

      // First login → load local data and sync with remote
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
    await clearDraft()
    set({ user: null, session: null, userRole: null, surveys: [], surveysLoaded: false, pendingDraft: null })
  },

  // ── Sync ─────────────────────────────────────────────────────────────
  syncing: false,

  async triggerSync() {
    const { user, userRole, syncing } = get()
    if (!user || syncing) return
    set({ syncing: true })
    try {
      const role = userRole ?? 'encuestador'
      const { pushed, pulled } = await fullSync(user.id, role)
      if (pulled > 0) {
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
    clearDraft()
    set({ view: 'encuestas', wizard: null, pendingDraft: null })

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
    clearDraft()
    set(s => ({
      surveys: s.surveys.map(sv => (sv.id === id ? updated : sv)),
      view: 'encuestas',
      wizard: null,
      pendingDraft: null,
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
    const existing = get().surveys.find(sv => sv.id === id)
    if (!existing) return

    // Optimistic removal from the UI; the durable delete (IDB + remote) is
    // deferred so an accidental delete can be undone within the grace window.
    set(s => ({ surveys: s.surveys.filter(sv => sv.id !== id) }))

    let undone = false
    const GRACE_MS = 5000
    get().pushToast('Encuesta eliminada', 'info', {
      label: 'Deshacer',
      onClick: () => {
        undone = true
        set(s => ({
          surveys: [...s.surveys, existing].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }))
      },
    }, GRACE_MS)

    setTimeout(async () => {
      if (undone) return
      await deleteSurvey(id)
      const { user } = get()
      if (user) deleteSurveyRemote(id)
    }, GRACE_MS)
  },

  // ── Wizard ────────────────────────────────────────────────────────────
  wizard: null,
  pendingDraft: null,
  openWizard(surveyCount) {
    const { settings } = get()
    const nuiEtr = settings.nuiEncuestador ? parseInt(settings.nuiEncuestador, 10) || null : null
    const draft: SurveyDraft = {
      ...EMPTY_DRAFT,
      fEta:   todayISO(),
      nuiEtr,
      nui:    surveyCount + 1,
    }
    const wizard: WizardState = { step: 1, draft }
    set({ wizard, view: 'wizard', pendingDraft: null })
    saveDraft(wizard)
  },
  openEditWizard(survey) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, syncStatus, ...draft } = survey
    const wizard: WizardState = { step: 1, draft, editingId: id }
    set({ wizard, view: 'wizard', pendingDraft: null })
    saveDraft(wizard)
  },
  closeWizard() {
    clearDraft()
    set({ wizard: null, view: 'encuestas', pendingDraft: null })
  },
  setWizardStep(step) {
    set(s => s.wizard ? { wizard: { ...s.wizard, step } } : {})
    const { wizard } = get()
    if (wizard) saveDraft(wizard)
  },
  updateDraft(patch) {
    set(s =>
      s.wizard
        ? { wizard: { ...s.wizard, draft: { ...s.wizard.draft, ...patch } } }
        : {}
    )
    const { wizard } = get()
    if (wizard) saveDraft(wizard)
  },

  // Resume / discard a persisted in-progress survey
  async loadDraft() {
    const pendingDraft = await getDraft()
    set({ pendingDraft })
  },
  resumeDraft() {
    const { pendingDraft } = get()
    if (!pendingDraft) return
    set({ wizard: pendingDraft, view: 'wizard', pendingDraft: null })
  },
  async discardDraft() {
    await clearDraft()
    set({ pendingDraft: null })
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
  pushToast(message, level = 'success', action, duration = 3200) {
    const id = uuid()
    set(s => ({ toasts: [...s.toasts, { id, message, level, action }] }))
    setTimeout(() => get().removeToast(id), duration)
  },
  removeToast(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
  },
}))
