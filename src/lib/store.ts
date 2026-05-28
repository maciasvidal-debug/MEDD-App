import { create } from 'zustand'
import type { Survey, AppView, WizardState, Settings, SurveyDraft } from '../types'
import {
  getAllSurveys, saveSurvey, deleteSurvey,
  getSettings, saveSettings,
} from '../lib/db'
import { uuid, todayISO } from '../lib/utils'
import { EMPTY_DRAFT, DEFAULT_SETTINGS } from '../lib/constants'

// ─── Toast ────────────────────────────────────────────────────────────────

export type ToastLevel = 'success' | 'error' | 'info'
export interface Toast { id: string; message: string; level: ToastLevel }

// ─── Store interface ──────────────────────────────────────────────────────

interface AppStore {
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
  view: 'dashboard',
  setView: (view) => set({ view }),

  surveys: [],
  surveysLoaded: false,
  async loadSurveys() {
    const surveys = await getAllSurveys()
    set({ surveys, surveysLoaded: true })
  },
  async addSurvey(draft) {
    const now    = new Date().toISOString()
    const survey: Survey = { ...draft, id: uuid(), createdAt: now, updatedAt: now }
    await saveSurvey(survey)
    set(s => ({ surveys: [survey, ...s.surveys] }))
    get().pushToast('Encuesta guardada correctamente')
    set({ view: 'encuestas', wizard: null })
  },
  async updateSurvey(id, draft) {
    const existing = get().surveys.find(s => s.id === id)
    if (!existing) return
    const updated: Survey = {
      ...existing, ...draft,
      id, createdAt: existing.createdAt, updatedAt: new Date().toISOString(),
    }
    await saveSurvey(updated)
    set(s => ({
      surveys: s.surveys.map(sv => (sv.id === id ? updated : sv)),
      view: 'encuestas',
      wizard: null,
    }))
    get().pushToast('Encuesta actualizada')
  },
  async removeSurvey(id) {
    await deleteSurvey(id)
    set(s => ({ surveys: s.surveys.filter(sv => sv.id !== id) }))
    get().pushToast('Encuesta eliminada', 'info')
  },

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
    const { id, createdAt, updatedAt, ...draft } = survey
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
