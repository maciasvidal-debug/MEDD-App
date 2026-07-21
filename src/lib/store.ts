import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Survey, AppView, WizardState, Settings, SurveyDraft, UserRole } from '../types'
import {
  getAllSurveys, saveSurvey, saveManySurveys, deleteSurvey,
  getSettings, saveSettings,
  getDraft, saveDraft, clearDraft,
  clearLocalUserData,
  addDeletion, removeDeletion,
} from '../lib/db'
import { supabase } from '../lib/supabase'
import { pushSurvey, deleteSurveyRemote, fullSync, fetchProfile, upsertProfile } from '../lib/sync'
import { isProfileComplete, surveyMissingProfile } from '../lib/validators'
import { uuid } from '../lib/utils'
import { todayISO } from '../lib/date'
import { EMPTY_DRAFT, DEFAULT_SETTINGS, INSTRUMENT_VERSION } from '../lib/constants'

// ─── Toast ────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'
export type Density = 'comfortable' | 'compact'

// Código de hogar corto y legible (H-XXXXXX). Autogenerado en cada captura y
// editable, para que el encuestador pueda reutilizar el mismo código en las
// demás personas del hogar. Deriva del uuid para heredar su unicidad.
function newHogarId(): string {
  return 'H-' + uuid().replace(/-/g, '').slice(0, 6).toUpperCase()
}

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

// First-run welcome tour: remembered per user so it shows once automatically
// but can be re-opened on demand from Ajustes. Stored in localStorage (not the
// per-user IDB stores) so it survives the cross-user wipe and is cheap to read.
const WELCOME_KEY = 'medd_welcome_seen'
function welcomeSeen(uid: string): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(`${WELCOME_KEY}:${uid}`) === '1'
}
function markWelcomeSeen(uid: string): void {
  try { localStorage.setItem(`${WELCOME_KEY}:${uid}`, '1') } catch { /* private mode */ }
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
  // Whether the account is approved (user_roles.active). Defaults true and only
  // flips false when the role lookup explicitly returns an inactive row, so a
  // failed/slow lookup never locks out a legitimate user — the RLS policy is the
  // real gate; this only drives the "pending approval" UI.
  userActive: boolean
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
  backfillProfile: () => Promise<void>

  wizard: WizardState | null
  openWizard: (surveyCount: number) => void
  openBackcheckWizard: (original: Survey) => void
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

  // First-run welcome tour (role-aware; shown once, re-openable from Ajustes)
  welcomeOpen: boolean
  openWelcome: () => void
  closeWelcome: () => void
  maybeOpenWelcome: () => void
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

// Debounced draft persistence: updateDraft fires on every keystroke, but writing
// to IndexedDB that often is wasteful on low-end field devices. We coalesce
// writes and always persist the LATEST wizard state at fire time (reading it
// fresh from the store), so a step change saved immediately is never clobbered
// by a stale queued write — and a cleared draft (wizard === null) is not resurrected.
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null
function persistDraftDebounced(): void {
  if (draftSaveTimer) clearTimeout(draftSaveTimer)
  draftSaveTimer = setTimeout(() => {
    const w = useStore.getState().wizard
    if (w) saveDraft(w)
  }, 400)
}

export const useStore = create<AppStore>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────
  user: null,
  session: null,
  authReady: false,
  userRole: null,
  userActive: true,

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
        set({ userRole: null, userActive: true })
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
          let userActive = true
          try {
            const { data: roleRow } = await supabase
              .from('user_roles')
              .select('role, active')
              .eq('user_id', next.id)
              .single()
            userRole = (roleRow?.role as UserRole) ?? 'encuestador'
            // Only an explicit `active === false` gates the user; a missing row
            // or absent column (older schema) is treated as active — RLS still
            // enforces the real rule server-side.
            userActive = (roleRow as { active?: boolean } | null)?.active !== false
          } catch {
            // Role lookup is best-effort; fall back to the default role rather
            // than leaving the user in a broken/blocked state.
          }
          set({ userRole, userActive })

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

    // Auto-sync when the device regains connectivity. This is an offline-first
    // field app: surveys captured offline stay 'local' until a sync runs, and
    // previously the only triggers were login/reload and the manual button. Now
    // a reconnect flushes pending surveys automatically. triggerSync no-ops when
    // logged out or already syncing, so this is safe to fire on every 'online'.
    const onOnline = () => { get().triggerSync() }
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

    // Also flush when the user returns to the app (tab refocus / app resume) and
    // there's connectivity — covers the common field case where the device never
    // fired an 'online' event but regained signal while the app was backgrounded.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) get().triggerSync()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)

    return () => {
      subscription.unsubscribe()
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    }
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
      // Para-data: stamp when this capture session began (set in openWizard) so
      // interview duration = createdAt − startedAt is available for QC.
      startedAt: get().wizard?.startedAt,
      // QC re-interview linkage (set in openBackcheckWizard), if any.
      backcheckOf: get().wizard?.backcheckOf,
      // Stamp the instrument version so analytics can scope the motives battery
      // to records that were actually asked it (older records stay undefined).
      instrumentVersion: INSTRUMENT_VERSION,
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
      pushSurvey(survey, user.id)
        .then(ok => { if (ok) saveSurvey({ ...survey, syncStatus: 'synced' }) })
        .catch(() => { /* stays 'local'; the next sync retries */ })
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
      pushSurvey(updated, user.id)
        .then(ok => { if (ok) saveSurvey({ ...updated, syncStatus: 'synced' }) })
        .catch(() => { /* stays 'local'; the next sync retries */ })
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
      // Record a tombstone so a failed/offline remote delete is retried on the
      // next sync and the row is never resurrected by a pull in the meantime.
      await addDeletion(id)
      const { user } = get()
      if (user) {
        const ok = await deleteSurveyRemote(id)
        if (ok) await removeDeletion(id)
      }
    }, GRACE_MS)
  },

  // Backfill the surveyor profile onto surveys captured before it was complete,
  // filling only blank fields from the current (complete) profile. Restricted to
  // encuestadores: their local store only holds their own RLS-scoped surveys, so
  // this can never overwrite another surveyor's data (an investigador holds the
  // whole pulled dataset and must never run this).
  async backfillProfile() {
    const { surveys, settings, userRole, user } = get()
    if (!user || userRole === 'investigador') return
    const semestre = settings.etrSemestre ? parseInt(settings.etrSemestre, 10) || null : null
    const nuiEtr   = settings.nuiEncuestador ? parseInt(settings.nuiEncuestador, 10) || null : null
    const now = new Date().toISOString()

    const updated: Survey[] = []
    const next = surveys.map(s => {
      if (!surveyMissingProfile(s)) return s
      const patched: Survey = {
        ...s,
        nuiEtr:         s.nuiEtr ?? nuiEtr,
        etrPrograma:    s.etrPrograma    || settings.etrPrograma,
        etrTipoInst:    s.etrTipoInst    || settings.etrTipoInst,
        etrSemestre:    s.etrSemestre ?? semestre,
        etrInstitucion: s.etrInstitucion || settings.etrInstitucion,
        updatedAt:  now,
        syncStatus: 'local',
      }
      updated.push(patched)
      return patched
    })

    if (updated.length === 0) {
      get().pushToast('No hay encuestas por completar', 'info')
      return
    }
    await saveManySurveys(updated)
    set({ surveys: next })
    get().pushToast(`Perfil aplicado a ${updated.length} encuesta(s) anterior(es)`)
    // Push the updates to the server (no-op if offline; retried on reconnect).
    get().triggerSync()
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
      // Autogenera un identificador de hogar estable y editable: el encuestador
      // lo reutiliza (lo copia) para las demás personas del mismo hogar, de modo
      // que el agrupamiento por hogar queda registrado desde la captura.
      hogarId: newHogarId(),
      // Stamp the surveyor profile snapshot from settings onto the survey.
      etrPrograma:    settings.etrPrograma,
      etrTipoInst:    settings.etrTipoInst,
      etrSemestre:    settings.etrSemestre ? parseInt(settings.etrSemestre, 10) || null : null,
      etrInstitucion: settings.etrInstitucion,
    }
    const wizard: WizardState = { step: 1, draft, startedAt: new Date().toISOString() }
    set({ wizard, view: 'wizard', pendingDraft: null })
    saveDraft(wizard)
  },
  // Start a blind quality-control re-interview of `original`: a fresh empty draft
  // (the original's answers are NOT copied, to avoid biasing the back-check),
  // linked via backcheckOf so agreement (κ/ICC) can be computed later.
  openBackcheckWizard(original) {
    const { settings, surveys } = get()
    const nuiEtr = settings.nuiEncuestador ? parseInt(settings.nuiEncuestador, 10) || null : null
    const draft: SurveyDraft = {
      ...EMPTY_DRAFT,
      fEta:   todayISO(),
      nuiEtr,
      nui:    surveys.length + 1,
      // Un back-check re-verifica el MISMO hogar → hereda su hogar_id (si el
      // original no lo tuviera, se autogenera uno nuevo).
      hogarId: original.hogarId || newHogarId(),
      metodoSeleccion: original.metodoSeleccion,
      etrPrograma:    settings.etrPrograma,
      etrTipoInst:    settings.etrTipoInst,
      etrSemestre:    settings.etrSemestre ? parseInt(settings.etrSemestre, 10) || null : null,
      etrInstitucion: settings.etrInstitucion,
    }
    const wizard: WizardState = {
      step: 1, draft, startedAt: new Date().toISOString(), backcheckOf: original.id,
    }
    set({ wizard, view: 'wizard', pendingDraft: null })
    saveDraft(wizard)
  },
  openEditWizard(survey) {
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
    // Debounced: keystrokes coalesce into one IndexedDB write (see helper above).
    if (get().wizard) persistDraftDebounced()
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

  // ── Welcome tour ────────────────────────────────────────────────────────
  welcomeOpen: false,
  openWelcome() {
    set({ welcomeOpen: true })
  },
  closeWelcome() {
    const u = get().user
    if (u) markWelcomeSeen(u.id)
    set({ welcomeOpen: false })
  },
  maybeOpenWelcome() {
    const u = get().user
    if (u && !welcomeSeen(u.id)) set({ welcomeOpen: true })
  },
}))
