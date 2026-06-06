import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Survey, AppView, WizardState, Settings, SurveyDraft, UserRole } from '../types'
import {
  getAllSurveys, saveSurvey, deleteSurvey,
  getSettings, saveSettings,
  getDraft, saveDraft, clearDraft,
  clearLocalUserData,
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { pushSurvey, deleteSurveyRemote, fullSync, fetchProfile, upsertProfile } from '../lib/sync'
import { isProfileComplete } from '../lib/validators'
import { uuid, todayISO } from '../lib/utils'
import { EMPTY_DRAFT, DEFAULT_SETTINGS } from '../lib/constants'

// ─── Toast ────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'
export type Density = 'comfortable' | 'compact'

const THEME_KEY = 'medd_theme'
function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_KEY, theme)
  // Keep the mobile browser chrome in sync with the active surface.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B1220' : '#0F766E')
}

const DENSITY_KEY = 'medd_density'
function readDensity(): Density {
  if (typeof window === 'undefined') return 'comfortable'
  return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
}
function applyDensity(density: Density) {
  document.documentElement.setAttribute('data-density', density)
  localStorage.setItem(DENSITY_KEY, density)
}

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

  // Theme (light/dark)
  theme: Theme
  toggleTheme: () => void

  // Density (comfortable/compact)
  density: Density
  setDensity: (d: Density) => void
}

// Track which account owns the local data so we can wipe device-local stores
// when a *different* user signs in (preventing cross-user data bleed), while
// preserving local data when the same user signs back in.
const LAST_UID_KEY = 'medd_last_uid'
async function applyUserScope(uid: string): Promise<void> {
  const last = localStorage.getItem(LAST_UID_KEY)
  if (last && last !== uid) {
    await clearLocalUserData()
  }
  localStorage.setItem(LAST_UID_KEY, uid)
}

// ─── Store implementation ─────────────────────────────────────────────────

export const useStore = create<AppStore>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────
  user: null,
  session: null,
  authReady: false,
  userRole: null,

  initAuth() {
    // `onAuthStateChange` is the single source of truth: supabase-js fires an
    // `INITIAL_SESSION` event immediately on subscribe (covering a page reload
    // with a restored session), so a separate `getSession()` call is redundant.
    //
    // CRITICAL: this callback runs while supabase-js holds an internal auth
    // lock. Calling any other Supabase API that needs the JWT (e.g. a
    // `from(...)` query) and awaiting it *inside* the callback deadlocks the
    // client — that lock is never released, which froze the app on reload and
    // made `signOut` hang silently. So we keep this callback synchronous: it
    // only updates React state, then defers all further Supabase work to a
    // macrotask via `setTimeout(0)`, which runs after the lock is released.
    // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const prev = get().user
      const next = session?.user ?? null

      // Resolve auth eagerly so the UI never gets stuck on the loading spinner,
      // even if the deferred role lookup below is slow or fails.
      set({ session, user: next, authReady: true })

      if (!next) {
        set({ userRole: null })
        return
      }

      const differentUser = next.id !== prev?.id
      const isFreshSession = !prev

      // Deferred (post-lock) hydration: scope check, role lookup and sync.
      setTimeout(async () => {
        try {
          // A different account on this device → wipe the previous user's
          // local data before loading anything for the new one.
          if (differentUser) await applyUserScope(next.id)

          let userRole: UserRole = 'encuestador'
          try {
            const { data: roleRow } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', next.id)
              .single()
            userRole = (roleRow?.role as UserRole) ?? 'encuestador'
          } catch {
            // Role lookup is best-effort; fall back to the default role rather
            // than leaving the user in a broken/blocked state.
          }
          set({ userRole })

          // Load local settings first, then overlay the account-synced surveyor
          // profile (user_profiles) so it follows the user across devices and is
          // available for the completeness gate / survey stamping. Only non-empty
          // remote fields override local ones, so a half-filled remote row never
          // wipes good local data.
          await get().loadSettings()
          try {
            const remote = await fetchProfile()
            if (remote) {
              const cur = get().settings
              const merged: Settings = {
                ...cur,
                nuiEncuestador: remote.nuiEncuestador || cur.nuiEncuestador,
                etrPrograma:    remote.etrPrograma    || cur.etrPrograma,
                etrTipoInst:    remote.etrTipoInst    || cur.etrTipoInst,
                etrSemestre:    remote.etrSemestre    || cur.etrSemestre,
                etrInstitucion: remote.etrInstitucion || cur.etrInstitucion,
              }
              await saveSettings(merged)
              set({ settings: merged })
            }
          } catch {
            // Profile sync is best-effort; the local copy still gates correctly.
          }

          // Newly resolved session (login or restored on reload) → pull remote.
          if (isFreshSession) get().triggerSync()
        } catch {
          // Never let hydration errors leave the app wedged.
        }
      }, 0)
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
    // Offline-first field app: `scope: 'local'` clears the local session
    // without a mandatory network round-trip to revoke the token, so sign-out
    // works even with no connectivity. We still clear local state in `finally`
    // and surface any error instead of failing silently.
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    } catch {
      get().pushToast('Sesión cerrada localmente (sin conexión con el servidor).', 'info')
    } finally {
      await clearDraft()
      set({ user: null, session: null, userRole: null, surveys: [], surveysLoaded: false, pendingDraft: null })
    }
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
    const { settings, userRole } = get()
    // Hard gate: the surveyor profile is stamped onto every survey, so an
    // encuestador may not start one until the profile is complete. Route them
    // to Ajustes instead of silently capturing data with missing provenance.
    if (userRole === 'encuestador' && !isProfileComplete(settings)) {
      set({ view: 'ajustes' })
      get().pushToast('Completa tu perfil de encuestador antes de registrar encuestas.', 'info')
      return
    }
    const nuiEtr = settings.nuiEncuestador ? parseInt(settings.nuiEncuestador, 10) || null : null
    const draft: SurveyDraft = {
      ...EMPTY_DRAFT,
      fEta:   todayISO(),
      nuiEtr,
      nui:    surveyCount + 1,
      // Stamp the surveyor profile snapshot from settings onto the survey.
      etrPrograma:    settings.etrPrograma,
      etrTipoInst:    settings.etrTipoInst,
      etrSemestre:    settings.etrSemestre ? parseInt(settings.etrSemestre, 10) || null : null,
      etrInstitucion: settings.etrInstitucion,
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
    // Mirror the surveyor profile to the account so it survives device changes
    // and local-data wipes. Best-effort/background: local save already succeeded.
    const { user } = get()
    if (user) upsertProfile(user.id, settings)
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

  // ── Theme ─────────────────────────────────────────────────────────────
  theme: readTheme(),
  toggleTheme() {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },

  // ── Density ───────────────────────────────────────────────────────────
  density: readDensity(),
  setDensity(density) {
    applyDensity(density)
    set({ density })
  },
}))
