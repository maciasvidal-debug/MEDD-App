import type { SurveyDraft, Settings } from '../types'

// ─── Options ──────────────────────────────────────────────────────────────────

export const OPT = {
  etnia:   ['Indígena', 'Gitano/ROM', 'Afrodescendiente/Negro', 'Ninguna'] as const,
  eps:     ['Contributivo', 'Subsidiado', 'Régimen especial', 'No afiliado'] as const,
  labor:   ['Empleado', 'Trab. independiente', 'Hogar', 'Pensionado', 'Estudiante'] as const,
  ingreso: ['< 1 SMMLV', '1–3 SMMLV', '> 4 SMMLV', 'No responde'] as const,
  educ:    ['Ninguno', 'Básica primaria', 'Básica secundaria', 'Bachiller', 'Técnica/Tecnológica', 'Profesional'] as const,
  salud:   ['Buena', 'Regular', 'Mala'] as const,
  unidad:  ['mcg', 'mg', 'g', 'UI', '%'] as const,
  sino:    ['Sí', 'No'] as const,
} as const

export const STEP_LABELS = [
  { n: 1, label: 'Identificación',   icon: 'ti-id-badge' },
  { n: 2, label: 'Demografía',        icon: 'ti-users' },
  { n: 3, label: 'Salud',             icon: 'ti-heart-rate-monitor' },
  { n: 4, label: 'Medicamentos',      icon: 'ti-pill' },
  { n: 5, label: 'Medicamento reg.',  icon: 'ti-database-search' },
  { n: 6, label: 'Confirmar',         icon: 'ti-check' },
] as const

export const TOTAL_STEPS = STEP_LABELS.length

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const EMPTY_DRAFT: SurveyDraft = {
  fechaEncuesta: '',
  nuiEncuestador: '',
  nui: '',
  fechaNac: '',
  etnia: '',
  eps: '',
  labor: '',
  ingreso: '',
  educ: '',
  perSalud: '',
  estSalud: '',
  prbSalud: '',
  conMed: '',
  medPrc: '',
  indMed: '',
  medSob: '',
  dispVenc: '',
  ctoDisp: '',
  hayVenc: '',
  cantMed: null,
  cantVenc: null,
  pesoMed: null,
  nmMed: '',
  dci: '',
  concMed: null,
  undConc: '',
  obs: '',
}

export const DEFAULT_SETTINGS: Settings = {
  nombreProyecto: 'MEDD – Medicamentos No Utilizados',
  instituciones: '',
  nuiEncuestador: '',
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const CUM_API = 'https://www.datos.gov.co/resource/i7cb-raxc.json'
export const CUM_FIELDS = 'producto,principioactivo,concentracion,unidadmedida,formafarmaceutica,viaadministracion'
