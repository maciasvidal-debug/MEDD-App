// ─── Codebook-aligned domain types ───────────────────────────────────────────
// Field names mirror FIELD_ID from the structured schema (camelCase).

export type SiNo = 'Sí' | 'No' | ''

// Controlled vocabularies — exact codebook values -------------------------
export type Etnia     = 'Indígena' | 'Gitano/ROM' | 'Afrodescendiente' | 'Ninguna' | ''
export type AsSalud   = 'Contributivo' | 'Subsidiado' | 'Especial' | 'No afiliado' | ''
export type EstLab    = 'Empleado' | 'Independiente' | 'Hogar' | 'Pensionado' | 'Estudiante' | ''
export type Ingreso   = '< 1 SMMLV' | '1-3 SMMLV' | '> 4 SMMLV' | 'No responde' | ''
export type NvEstu    = 'Ninguno' | 'Primaria' | 'Secundaria' | 'Bachiller' | 'Técnico' | 'Profesional' | 'Posgrado' | ''
export type NvPosg    = 'Especialización' | 'Maestría' | 'Doctorado' | ''
export type PercSalud = 'Buena' | 'Regular' | 'Mala' | ''
export type UnidadConc = 'mcg' | 'mg' | 'g' | 'UI' | '%' | ''

// ─── 1:N medication sub-record ─────────────────────────────────────────────
export interface Medication {
  nmMed:   string           // NM_MED : Nombre comercial
  dci:     string           // DCI    : Denominación Común Internacional
  concMed: number | null    // CONC_MED
  undConc: UnidadConc       // UND_CONC
  fVto:    string           // F_VTO  : Fecha de vencimiento YYYY-MM-DD
}

// ─── Survey (1 row per encuesta) ──────────────────────────────────────────
export interface Survey {
  /** UUID — IDB primary key */
  id:        string
  createdAt: string
  updatedAt: string

  // Identificación
  fEta:   string        // F_ETA   : Fecha de la entrevista YYYY-MM-DD
  nuiEtr: number | null // NUI_ETR : ID Único del Encuestador (entero positivo)
  nui:    number        // NUI     : N° de registro correlativo (auto-increment)

  // Datos sociodemográficos
  fNac:    string        // F_NAC   : Fecha de nacimiento YYYY-MM-DD (< F_ETA)
  // EDAD: calculada F_ETA - F_NAC, no almacenada
  ciudad:  string        // CIUDAD
  dir:     string        // DIR     : Dirección de residencia
  estrato: number | null // ESTRATO : 1–6
  etnia:   Etnia         // ETNIA
  asSalud: AsSalud       // AS_SALUD
  estLab:  EstLab        // EST_LAB
  ingreso: Ingreso       // INGRESO
  nvEstu:  NvEstu        // NV_ESTU
  nvPosg:  NvPosg        // NV_POSG  : Nivel de posgrado (req. si NV_ESTU = Posgrado)

  // Estado de salud (cadena condicional)
  perSalud:  PercSalud  // PER_SALUD
  estSalud:  SiNo       // EST_SALUD  : ¿Enfermedad últimas 4 semanas?
  prbSalud:  string     // PRB_SALUD  : req. si estSalud = Sí
  conMed:    SiNo       // CON_MED    : req. si estSalud = Sí
  medPrc:    SiNo       // MED_PRC    : req. si conMed = Sí
  fPrc:      string     // F_PRC      : Fecha prescripción YYYY-MM-DD
  fDisp:     string     // F_DISP     : Fecha dispensación YYYY-MM-DD
  indMed:    SiNo       // IND_MED    : req. si medPrc = Sí

  // Medicamentos almacenados / disposición
  medSob:    SiNo           // MED_SOB
  dispMedVc: SiNo           // DISP_MED_VC
  ctoDispVc: string         // CTO_DISP_VC : req. si dispMedVc = Sí
  vtoMedNc:  SiNo           // VTO_MED_NC
  cantMed:   number | null  // CANT_MED    : >= 0
  cantMedVto:number | null  // CANT_MED_VTO: >= 0, <= cantMed
  pesoMedNc: number | null  // PESO_MED_NC : >= 0.0 (gramos)

  // 1:N medicamentos (sub-formulario)
  medications: Medication[]

  obs: string // OBS: Observaciones (opcional)

  syncStatus?: SyncStatus
}

export type SyncStatus = 'local' | 'synced' | 'syncing' | 'error'
export type UserRole   = 'encuestador' | 'investigador'

export type SurveyDraft = Omit<Survey, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>

// ─── CUM-INVIMA ────────────────────────────────────────────────────────────
export interface CUMRecord {
  producto:          string
  principioactivo:   string
  concentracion:     string
  unidadmedida:      string
  formafarmaceutica: string
  viaadministracion?: string
}

// ─── Auth ──────────────────────────────────────────────────────────────────
export type AuthView = 'login' | 'register'

// ─── UI state ──────────────────────────────────────────────────────────────
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

// ─── Analytics ─────────────────────────────────────────────────────────────
export interface ProductMetrics {
  tVto:      number | null  // T_VTO  = F_ETA − F_VTO  (días vencido en hogar)
  tDisp:     number | null  // T_DISP = F_ETA − F_DISP (ciclo total)
  vUtil:     number | null  // V_UTIL = F_VTO − F_DISP (vida útil al entregar)
  isExpired: boolean
}
