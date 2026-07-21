import type { Survey } from '../types'
import { CODEBOOK } from './constants'

// CSV serialization for data export, in codebook column order, plus the
// self-describing data-dictionary export.

const CSV_COLUMNS: (keyof Survey)[] = [
  'id', 'fEta', 'nui', 'nuiEtr', 'hogarId', 'metodoSeleccion',
  'etrPrograma', 'etrTipoInst', 'etrSemestre', 'etrInstitucion',
  'fNac',
  'ciudad', 'departamento', 'dir', 'estrato',
  'etnia', 'asSalud', 'estLab', 'ingreso', 'nvEstu', 'nvPosg',
  'perSalud', 'estSalud', 'prbSalud', 'conMed', 'medPrc',
  'fPrc', 'fDisp', 'indMed',
  'medSob', 'dispMedVc', 'ctoDispVc', 'vtoMedNc',
  'cantMed', 'cantMedVto', 'pesoMedNc',
  'obs', 'createdAt', 'updatedAt', 'startedAt', 'dataEnv',
]

// Motive/disposition columns (instrument v2). Kept after duracion_s so the
// para-data column order the tests assert on stays intact. Array fields are
// flattened with '; ' so each stays a single CSV cell.
const MOTIVE_COLUMNS: (keyof Survey)[] = [
  'instrumentVersion',
  'motNoConsumo', 'motNoConsumoOtro',
  'motVencimiento', 'motVencimientoOtro',
  'dispFinal', 'dispFinalOtro',
  'conocePuntos', 'cualPunto',
]

function escapeCSV(value: unknown): string {
  const str = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  // Quote (and double internal quotes) when the cell contains the delimiter, a
  // quote, or any line break — CR included, so a stray '\r' can't split a row.
  return /[",\n\r]/.test(str)
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

/**
 * Barrera de integridad de versión (Sec. 7 Rec. 1): el export NO debe emitir un
 * dataset con `instrumentVersion` nulo — el defecto dominante del piloto fue
 * exactamente eso (105/114 nulos, versiones mezcladas sin declarar). Los datos
 * reales llegan normalizados en la frontera de lectura (getAllSurveys / fromRow),
 * así que en producción esto nunca dispara; es una red de seguridad que hace
 * fallar rápido si un registro sin versión se colara hasta el export.
 *
 * No impide MEZCLAR versiones: cada fila declara la suya en la columna
 * `instrumentVersion`, así que las versiones quedan separadas por columna con la
 * versión declarada (lo que la recomendación admite explícitamente).
 */
export function assertVersioned(surveys: Survey[]): void {
  const sinVersion = surveys.filter(s => s.instrumentVersion == null)
  if (sinVersion.length > 0) {
    throw new Error(
      `Export bloqueado: ${sinVersion.length} registro(s) sin versión de instrumento ` +
      `(instrumentVersion nulo). Todo registro debe declarar su versión (1 ó 2) ` +
      `antes de exportar. IDs: ${sinVersion.map(s => s.id).join(', ')}`,
    )
  }
}

// duracion_s: para-data interview duration in seconds (createdAt − startedAt),
// a derived QC field for detecting implausibly fast (fabricated) interviews.
function durationCell(s: Survey): string {
  const durSec = s.startedAt && s.createdAt
    ? Math.round((new Date(s.createdAt).getTime() - new Date(s.startedAt).getTime()) / 1000)
    : null
  return durSec != null && durSec >= 0 ? String(durSec) : ''
}

// medications packed into a SINGLE cell: every stored product joined by '|', the
// five fields per product by ';' (nmMed;dci;concMed;undConc;fVto). Keeps the
// header and every data row at the same column count.
function medicationsCell(s: Survey): string {
  return s.medications?.length
    ? s.medications.map(m =>
        [m.nmMed, m.dci, m.concMed, m.undConc, m.fVto].map(escapeCSV).join(';'),
      ).join('|')
    : ''
}

// Pseudónimo estable y no trivialmente reversible del identificador de
// encuestador, para el export analítico: preserva el CLÚSTER (mismo encuestador
// → mismo código, necesario para modelar el efecto-encuestador) sin exponer el
// número crudo (que en el piloto podía ser un identificador personal). Hash FNV-1a.
export function encuestadorCluster(nuiEtr: number | null): string {
  if (nuiEtr == null) return ''
  let h = 2166136261
  const str = String(nuiEtr)
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return 'E-' + (h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7)
}

export function toCSV(surveys: Survey[]): string {
  // Rec. 1: rechaza de entrada cualquier registro sin versión declarada.
  assertVersioned(surveys)
  const header = [...CSV_COLUMNS, 'duracion_s', ...MOTIVE_COLUMNS, 'medications'].join(',')
  const rows = surveys.map(s => {
    const base = CSV_COLUMNS.map(col => escapeCSV(s[col])).join(',')
    const motives = MOTIVE_COLUMNS.map(col => escapeCSV(s[col])).join(',')
    return `${base},${durationCell(s)},${motives},${escapeCSV(medicationsCell(s))}`
  })
  return '﻿' + [header, ...rows].join('\n')
}

/**
 * Export analítico DES-IDENTIFICADO (Sec. 7 Rec. 6 · Habeas Data, Ley 1581).
 * Mejores prácticas de minimización SIN restar poder analítico:
 *   - Omite `dir` (dirección exacta): localizador directo de máxima
 *     reidentificación y de escaso valor analítico (la geografía ya está en
 *     ciudad/departamento/estrato).
 *   - Seudonimiza `nuiEtr` → `encuestadorCluster` (código estable): conserva el
 *     clúster de encuestador para el modelado del efecto-encuestador sin exponer
 *     el identificador personal.
 *   - CONSERVA el resto de variables analíticas, incluido el texto de salud
 *     (prbSalud, ctoDispVc, obs…) que alimenta el análisis cualitativo — para no
 *     restar poder analítico. El riesgo residual del texto libre se documenta.
 * Cada fila mantiene versión, hogar_id y clúster limpios (denominadores listos).
 */
const ANALYTICAL_COLUMNS = CSV_COLUMNS.filter(c => c !== 'dir')
export function toAnalyticalCSV(surveys: Survey[]): string {
  assertVersioned(surveys)
  const headerCols = ANALYTICAL_COLUMNS.map(c => (c === 'nuiEtr' ? 'encuestadorCluster' : c))
  const header = [...headerCols, 'duracion_s', ...MOTIVE_COLUMNS, 'medications'].join(',')
  const rows = surveys.map(s => {
    const base = ANALYTICAL_COLUMNS
      .map(col => (col === 'nuiEtr' ? escapeCSV(encuestadorCluster(s.nuiEtr)) : escapeCSV(s[col])))
      .join(',')
    const motives = MOTIVE_COLUMNS.map(col => escapeCSV(s[col])).join(',')
    return `${base},${durationCell(s)},${motives},${escapeCSV(medicationsCell(s))}`
  })
  return '﻿' + [header, ...rows].join('\n')
}

/** Emits the data dictionary (codebook) as a self-describing CSV, so exported
 *  datasets carry their own variable documentation for reproducible analysis. */
export function toCodebookCSV(): string {
  const header = ['variable', 'etiqueta', 'tipo', 'valores'].join(',')
  const rows = CODEBOOK.map(e =>
    [e.variable.trim(), e.etiqueta, e.tipo, e.valores].map(escapeCSV).join(','))
  return '﻿' + [header, ...rows].join('\n')
}
