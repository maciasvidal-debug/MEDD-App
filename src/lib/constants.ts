import type { SurveyDraft, Settings } from '../types'

// ─── Controlled vocabularies (exact codebook values) ─────────────────────

export const OPT = {
  etnia:   ['Indígena', 'Gitano/ROM', 'Afrodescendiente', 'Ninguna'] as const,
  asSalud: ['Contributivo', 'Subsidiado', 'Especial', 'No afiliado'] as const,
  estLab:  ['Empleado', 'Independiente', 'Hogar', 'Pensionado', 'Estudiante'] as const,
  ingreso: ['< 1 SMMLV', '1-3 SMMLV', '> 4 SMMLV', 'No responde'] as const,
  nvEstu:  ['Ninguno', 'Primaria', 'Secundaria', 'Bachiller', 'Técnico', 'Profesional', 'Posgrado'] as const,
  nvPosg:  ['Especialización', 'Maestría', 'Doctorado'] as const,
  perSalud:['Buena', 'Regular', 'Mala'] as const,
  undConc: ['mcg', 'mg', 'g', 'UI', '%'] as const,
  sino:    ['Sí', 'No'] as const,
  estrato: [1, 2, 3, 4, 5, 6] as const,
  etrPrograma: ['Medicina', 'Enfermería', 'Regencia en Farmacia', 'Química Farmacéutica', 'Odontología', 'Bacteriología', 'Nutrición y Dietética', 'Otra'] as const,
  etrTipoInst: ['Pública', 'Privada'] as const,
} as const

// Main Colombian cities (CIUDAD dropdown)
export const CIUDADES = [
  'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta',
  'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué', 'Manizales', 'Villavicencio',
  'Pasto', 'Neiva', 'Armenia', 'Montería', 'Sincelejo', 'Popayán', 'Valledupar',
  'Tunja', 'Riohacha', 'Florencia', 'Quibdó', 'Yopal', 'Mocoa', 'Leticia', 'Otro',
] as const

// ─── Wizard step labels ───────────────────────────────────────────────────

export const STEP_LABELS = [
  { n: 1, label: 'Identificación',  icon: 'ti-id-badge' },
  { n: 2, label: 'Demografía',      icon: 'ti-users' },
  { n: 3, label: 'Salud',           icon: 'ti-heart-rate-monitor' },
  { n: 4, label: 'Almacenamiento',  icon: 'ti-package' },
  { n: 5, label: 'Medicamentos',    icon: 'ti-pill' },
  { n: 6, label: 'Confirmar',       icon: 'ti-check' },
] as const

export const TOTAL_STEPS = STEP_LABELS.length

// ─── Empty draft (all codebook fields) ───────────────────────────────────

export const EMPTY_DRAFT: SurveyDraft = {
  fEta:       '',
  nuiEtr:     null,
  nui:        0,
  etrPrograma:    '',
  etrTipoInst:    '',
  etrSemestre:    null,
  etrInstitucion: '',
  fNac:       '',
  ciudad:     '',
  dir:        '',
  estrato:    null,
  etnia:      '',
  asSalud:    '',
  estLab:     '',
  ingreso:    '',
  nvEstu:     '',
  nvPosg:     '',
  perSalud:   '',
  estSalud:   '',
  prbSalud:   '',
  conMed:     '',
  medPrc:     '',
  fPrc:       '',
  fDisp:      '',
  indMed:     '',
  medSob:     '',
  dispMedVc:  '',
  ctoDispVc:  '',
  vtoMedNc:   '',
  cantMed:    null,
  cantMedVto: null,
  pesoMedNc:  null,
  medications:[],
  obs:        '',
}

export const DEFAULT_SETTINGS: Settings = {
  nombreProyecto: 'MEDD – Medicamentos No Utilizados',
  instituciones:  '',
  nuiEncuestador: '',
  etrPrograma:    '',
  etrTipoInst:    '',
  etrSemestre:    '',
  etrInstitucion: '',
}

// ─── API ──────────────────────────────────────────────────────────────────

export const CUM_API    = 'https://www.datos.gov.co/resource/i7cb-raxc.json'
export const CUM_FIELDS = 'producto,principioactivo,concentracion,unidadmedida,formafarmaceutica,viaadministracion'

// ─── Codebook field help (standardisation) ────────────────────────────────
// Plain-language definitions surfaced as inline tooltips and in the wizard's
// "Guía de campo". Standardising how every surveyor reads each field reduces
// inter-observer measurement variability (the effect the dashboard QC detects).
export const FIELD_GUIDE = [
  { key: 'fEta',       term: 'Fecha de la entrevista', def: 'Día en que se realiza la entrevista en el hogar (no la fecha de digitación si se captura después).' },
  { key: 'estrato',    term: 'Estrato socioeconómico', def: 'Estrato de la vivienda (1 más bajo – 6 más alto), según el recibo de servicios públicos.' },
  { key: 'asSalud',    term: 'Régimen de salud', def: 'Afiliación al SGSSS: Contributivo (cotizante), Subsidiado (SISBÉN), Especial (FF. MM., magisterio…) o No afiliado.' },
  { key: 'estLab',     term: 'Ocupación', def: 'Actividad principal actual de la persona entrevistada.' },
  { key: 'medSob',     term: 'Medicamentos sin consumir', def: 'Medicamentos que el hogar conserva sin haber consumido (sobrantes), incluidos los aún vigentes.' },
  { key: 'dispMedVc',  term: 'Conoce la disposición', def: 'Si la persona conoce una forma adecuada de desechar medicamentos vencidos (punto azul, farmacia, etc.).' },
  { key: 'vtoMedNc',   term: 'Vencidos observados', def: 'Si, al revisar físicamente, hay al menos una unidad vencida entre los medicamentos guardados.' },
  { key: 'cantMed',    term: 'Cantidad sin consumir', def: 'Número total de unidades (tabletas, frascos, ampollas…) sin consumir, estén vencidas o no.' },
  { key: 'cantMedVto', term: 'Cantidad vencida', def: 'De las unidades sin consumir, cuántas están vencidas. No puede superar el total sin consumir.' },
  { key: 'pesoMedNc',  term: 'Peso (g)', def: 'Peso aproximado en gramos del total de medicamentos no consumidos (incluido el empaque).' },
  { key: 'fDisp',      term: 'Fecha de dispensación', def: 'Día en que el medicamento fue entregado/dispensado en la farmacia.' },
  { key: 'fVto',       term: 'Fecha de vencimiento', def: 'Fecha de vencimiento impresa en el empaque del medicamento.' },
] as const

export const FIELD_HELP: Record<string, string> =
  Object.fromEntries(FIELD_GUIDE.map(g => [g.key, g.def]))
