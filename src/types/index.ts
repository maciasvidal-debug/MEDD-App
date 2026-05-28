// ─── Domain types ────────────────────────────────────────────────────────────

export type SiNo = 'Sí' | 'No' | ''

export type Etnia = 'Indígena' | 'Gitano/ROM' | 'Afrodescendiente/Negro' | 'Ninguna' | ''
export type RegEPS = 'Contributivo' | 'Subsidiado' | 'Régimen especial' | 'No afiliado' | ''
export type EstLaboral = 'Empleado' | 'Trab. independiente' | 'Hogar' | 'Pensionado' | 'Estudiante' | ''
export type Ingreso = '< 1 SMMLV' | '1–3 SMMLV' | '> 4 SMMLV' | 'No responde' | ''
export type NivelEdu = 'Ninguno' | 'Básica primaria' | 'Básica secundaria' | 'Bachiller' | 'Técnica/Tecnológica' | 'Profesional' | ''
export type PercSalud = 'Buena' | 'Regular' | 'Mala' | ''
export type UnidadConc = 'mcg' | 'mg' | 'g' | 'UI' | '%' | ''

export interface Survey {
  /** UUID v4 generado al guardar */
  id: string
  /** ISO 8601 timestamp de creación */
  createdAt: string
  /** ISO 8601 timestamp de última edición */
  updatedAt: string

  // Identificación
  fechaEncuesta: string   // YYYY-MM-DD
  nuiEncuestador: string
  nui: string             // N° de registro correlativo

  // Demografía
  fechaNac: string        // YYYY-MM-DD
  /** Calculado desde fechaNac, no almacenado */
  etnia: Etnia
  eps: RegEPS
  labor: EstLaboral
  ingreso: Ingreso
  educ: NivelEdu

  // Salud
  perSalud: PercSalud
  estSalud: SiNo          // ¿Padeció enfermedad?
  prbSalud: string
  conMed: SiNo            // ¿Consume medicamentos?
  medPrc: SiNo            // ¿Prescritos?
  indMed: SiNo            // ¿Sigue indicaciones?

  // Medicamentos almacenados
  medSob: SiNo            // ¿Tiene sin consumir?
  dispVenc: SiNo          // ¿Sabe disposición vencidos?
  ctoDisp: string         // Descripción disposición
  hayVenc: SiNo           // ¿Hay vencidos? (observador)
  cantMed: number | null  // Cantidad unidades no consumidas
  cantVenc: number | null // Cantidad vencidas
  pesoMed: number | null  // Peso total (g)

  // Medicamento específico registrado
  nmMed: string
  dci: string
  concMed: number | null
  undConc: UnidadConc

  obs: string
}

export type SurveyDraft = Omit<Survey, 'id' | 'createdAt' | 'updatedAt'>

// ─── CUM-INVIMA ───────────────────────────────────────────────────────────────

export interface CUMRecord {
  producto: string
  principioactivo: string
  concentracion: string
  unidadmedida: string
  formafarmaceutica: string
  viaadministracion?: string
}

// ─── UI state ────────────────────────────────────────────────────────────────

export type AppView = 'dashboard' | 'encuestas' | 'wizard' | 'buscar' | 'exportar' | 'ajustes'

export interface WizardState {
  step: number
  draft: SurveyDraft
  editingId?: string
}

export interface Settings {
  nombreProyecto: string
  instituciones: string
  nuiEncuestador: string
}
