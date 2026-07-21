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
  // Método de selección muestral (diseño). Cierra el vacío del piloto: sin
  // registrar el diseño, el agrupamiento por hogar/encuestador no era modelable.
  metodoSeleccion: ['Aleatorio simple', 'Sistemático', 'Por conglomerados', 'Por conveniencia', 'Otro'] as const,
  // Motivos / disposición (instrumento v2). El valor «Otro» habilita un texto libre.
  motNoConsumo: ['No terminó el tratamiento', 'Mejoró / cedieron los síntomas', 'Efectos adversos', 'Cambio de tratamiento médico', 'Sobró de la dosis', 'Automedicación', 'Fallecimiento de un familiar', 'Otro'] as const,
  motVencimiento: ['Olvido', 'Acopio preventivo', 'Compró de más', 'Dosis sobrante', 'No sabía dónde desecharlos', 'Otro'] as const,
  dispFinal: ['Basura', 'Inodoro / desagüe', 'Devuelve a farmacia / punto azul', 'Regala', 'Los guarda', 'Otro'] as const,
} as const

// Instrument version stamped on every new capture. Bump when adding/removing
// survey questions so analytics can scope denominators to records that were
// actually asked the question (see Survey.instrumentVersion).
export const INSTRUMENT_VERSION = 2

// Earliest plausible interview date (F_ETA). Fieldwork for this study cannot
// predate 2024, so a date before this — or in the future — is a capture error
// (the pilot exported a record with F_ETA in 2012). Validated at capture in Zod
// so the implausible date never enters. Kept as a constant (not hard-coded in
// the schema) so a future wave can move the window in one place.
export const STUDY_START = '2024-01-01'

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
  hogarId:    '',
  metodoSeleccion: '',
  etrPrograma:    '',
  etrTipoInst:    '',
  etrSemestre:    null,
  etrInstitucion: '',
  fNac:       '',
  ciudad:     '',
  departamento: '',
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
  motNoConsumo:       [],
  motNoConsumoOtro:   '',
  motVencimiento:     [],
  motVencimientoOtro: '',
  dispFinal:          [],
  dispFinalOtro:      '',
  conocePuntos:       '',
  cualPunto:          '',
  obs:        '',
}

export const DEFAULT_SETTINGS: Settings = {
  nombreProyecto: 'MEDD – Medicamentos No Utilizados',
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

// ─── Data dictionary / codebook ───────────────────────────────────────────
// Machine- and human-readable documentation of every exported variable, so the
// CSV is self-describing for reproducible analysis (SPSS/R/Stata). Order mirrors
// the CSV columns produced by toCSV().
export interface CodebookEntry { variable: string; etiqueta: string; tipo: string; valores: string }
export const CODEBOOK: CodebookEntry[] = [
  { variable: 'id',            etiqueta: 'Identificador único del registro', tipo: 'texto (UUID)', valores: '—' },
  { variable: 'fEta',          etiqueta: 'Fecha de la entrevista', tipo: 'fecha', valores: 'AAAA-MM-DD' },
  { variable: 'nui',           etiqueta: 'Número de encuesta', tipo: 'entero', valores: 'consecutivo' },
  { variable: 'nuiEtr',        etiqueta: 'ID del encuestador (clúster de encuestador)', tipo: 'entero', valores: '—' },
  { variable: 'hogarId',       etiqueta: 'Identificador de hogar (clúster de hogar; co-residentes comparten código)', tipo: 'texto', valores: '— (vacío en históricos)' },
  { variable: 'metodoSeleccion', etiqueta: 'Método de selección muestral (diseño)', tipo: 'categórico', valores: 'Aleatorio simple; Sistemático; Por conglomerados; Por conveniencia; Otro (vacío en históricos)' },
  { variable: 'etrPrograma',   etiqueta: 'Programa académico del encuestador', tipo: 'categórico', valores: 'Medicina; Enfermería; Regencia en Farmacia; Química Farmacéutica; Odontología; Bacteriología; Nutrición y Dietética; Otra' },
  { variable: 'etrTipoInst',   etiqueta: 'Tipo de institución del encuestador', tipo: 'categórico', valores: 'Pública; Privada' },
  { variable: 'etrSemestre',   etiqueta: 'Semestre académico del encuestador', tipo: 'entero', valores: '1–12' },
  { variable: 'etrInstitucion',etiqueta: 'Institución del encuestador', tipo: 'texto', valores: '—' },
  { variable: 'fNac',          etiqueta: 'Fecha de nacimiento del entrevistado', tipo: 'fecha', valores: 'AAAA-MM-DD' },
  { variable: 'ciudad',        etiqueta: 'Municipio de residencia (canónico, sin departamento)', tipo: 'texto', valores: 'municipio DANE' },
  { variable: 'departamento',  etiqueta: 'Departamento de residencia', tipo: 'texto', valores: 'departamento DANE' },
  { variable: 'dir',           etiqueta: 'Dirección de residencia', tipo: 'texto', valores: '—' },
  { variable: 'estrato',       etiqueta: 'Estrato socioeconómico de la vivienda', tipo: 'ordinal', valores: '1–6 (1 más bajo)' },
  { variable: 'etnia',         etiqueta: 'Pertenencia étnica', tipo: 'categórico', valores: 'Indígena; Gitano/ROM; Afrodescendiente; Ninguna' },
  { variable: 'asSalud',       etiqueta: 'Régimen de afiliación en salud', tipo: 'categórico', valores: 'Contributivo; Subsidiado; Especial; No afiliado' },
  { variable: 'estLab',        etiqueta: 'Ocupación actual', tipo: 'categórico', valores: 'Empleado; Independiente; Hogar; Pensionado; Estudiante' },
  { variable: 'ingreso',       etiqueta: 'Ingresos mensuales del hogar', tipo: 'ordinal', valores: '< 1 SMMLV; 1-3 SMMLV; > 4 SMMLV; No responde' },
  { variable: 'nvEstu',        etiqueta: 'Nivel educativo', tipo: 'ordinal', valores: 'Ninguno; Primaria; Secundaria; Bachiller; Técnico; Profesional; Posgrado' },
  { variable: 'nvPosg',        etiqueta: 'Nivel de posgrado', tipo: 'categórico', valores: 'Especialización; Maestría; Doctorado' },
  { variable: 'perSalud',      etiqueta: 'Percepción general de salud', tipo: 'ordinal', valores: 'Buena; Regular; Mala' },
  { variable: 'estSalud',      etiqueta: 'Enfermedad reciente', tipo: 'binario', valores: 'Sí; No' },
  { variable: 'prbSalud',      etiqueta: 'Principal problema de salud', tipo: 'texto', valores: '—' },
  { variable: 'conMed',        etiqueta: 'Consume medicamentos para el problema', tipo: 'binario', valores: 'Sí; No' },
  { variable: 'medPrc',        etiqueta: 'Medicamentos prescritos por profesional', tipo: 'binario', valores: 'Sí; No' },
  { variable: 'fPrc',          etiqueta: 'Fecha de prescripción médica', tipo: 'fecha', valores: 'AAAA-MM-DD' },
  { variable: 'fDisp',         etiqueta: 'Fecha de dispensación en farmacia', tipo: 'fecha', valores: 'AAAA-MM-DD' },
  { variable: 'indMed',        etiqueta: 'Sigue las indicaciones del profesional', tipo: 'binario', valores: 'Sí; No' },
  { variable: 'medSob',        etiqueta: 'Tiene medicamentos guardados sin consumir', tipo: 'binario', valores: 'Sí; No' },
  { variable: 'dispMedVc',     etiqueta: 'Conoce la disposición de medicamentos vencidos', tipo: 'binario', valores: 'Sí; No' },
  { variable: 'ctoDispVc',     etiqueta: 'Práctica de disposición de vencidos', tipo: 'texto', valores: '—' },
  { variable: 'vtoMedNc',      etiqueta: 'Unidades vencidas observadas entre lo almacenado', tipo: 'binario', valores: 'Sí; No' },
  { variable: 'cantMed',       etiqueta: 'Cantidad de unidades sin consumir', tipo: 'entero', valores: '≥ 0' },
  { variable: 'cantMedVto',    etiqueta: 'Cantidad de unidades vencidas', tipo: 'entero', valores: '0 ≤ x ≤ cantMed' },
  { variable: 'pesoMedNc',     etiqueta: 'Peso de medicamentos no consumidos (gramos)', tipo: 'decimal', valores: '≥ 0' },
  { variable: 'obs',           etiqueta: 'Observaciones', tipo: 'texto', valores: '—' },
  { variable: 'createdAt',     etiqueta: 'Fecha de creación del registro (envío)', tipo: 'datetime ISO', valores: '—' },
  { variable: 'updatedAt',     etiqueta: 'Fecha de última modificación', tipo: 'datetime ISO', valores: '—' },
  { variable: 'startedAt',     etiqueta: 'Para-data: inicio de la captura (apertura del asistente)', tipo: 'datetime ISO', valores: '— (vacío en registros previos)' },
  { variable: 'dataEnv',       etiqueta: 'Ambiente de datos (piloto vs producción)', tipo: 'categórico', valores: 'pilot; prod' },
  { variable: 'duracion_s',    etiqueta: 'Para-data: duración de la entrevista en segundos (createdAt − startedAt)', tipo: 'entero', valores: '≥ 0 (vacío si no hay startedAt)' },
  { variable: 'instrumentVersion', etiqueta: 'Versión del instrumento al capturar (1 = sin batería de motivos)', tipo: 'entero', valores: '1; 2 (obligatorio, no nulo)' },
  { variable: 'motNoConsumo',      etiqueta: 'Motivos de no consumo (selección múltiple)', tipo: 'multivalor', valores: 'No terminó el tratamiento; Mejoró / cedieron los síntomas; Efectos adversos; Cambio de tratamiento médico; Sobró de la dosis; Automedicación; Fallecimiento de un familiar; Otro' },
  { variable: 'motNoConsumoOtro',  etiqueta: 'Motivo de no consumo — otro (texto)', tipo: 'texto', valores: '—' },
  { variable: 'motVencimiento',    etiqueta: 'Razones de acumulación/vencimiento (selección múltiple)', tipo: 'multivalor', valores: 'Olvido; Acopio preventivo; Compró de más; Dosis sobrante; No sabía dónde desecharlos; Otro' },
  { variable: 'motVencimientoOtro',etiqueta: 'Razón de acumulación — otro (texto)', tipo: 'texto', valores: '—' },
  { variable: 'dispFinal',         etiqueta: 'Conducta real de disposición (selección múltiple)', tipo: 'multivalor', valores: 'Basura; Inodoro / desagüe; Devuelve a farmacia / punto azul; Regala; Los guarda; Otro' },
  { variable: 'dispFinalOtro',     etiqueta: 'Conducta de disposición — otro (texto)', tipo: 'texto', valores: '—' },
  { variable: 'conocePuntos',      etiqueta: 'Conoce puntos de recolección posconsumo', tipo: 'binario', valores: 'Sí; No (vacío = no preguntado)' },
  { variable: 'cualPunto',         etiqueta: 'Cuál punto de recolección conoce', tipo: 'texto', valores: '—' },
  { variable: 'medications',   etiqueta: 'Medicamentos almacenados (lista; productos separados por |, campos por ;)', tipo: 'compuesto', valores: 'nmMed;dci;concMed;undConc;fVto' },
  { variable: '  nmMed',       etiqueta: '— Nombre comercial del medicamento', tipo: 'texto', valores: '—' },
  { variable: '  dci',         etiqueta: '— Principio activo (DCI)', tipo: 'texto', valores: '—' },
  { variable: '  concMed',     etiqueta: '— Concentración', tipo: 'decimal', valores: '≥ 0' },
  { variable: '  undConc',     etiqueta: '— Unidad de concentración', tipo: 'categórico', valores: 'mcg; mg; g; UI; %' },
  { variable: '  fVto',        etiqueta: '— Fecha de vencimiento', tipo: 'fecha', valores: 'AAAA-MM-DD' },
]
