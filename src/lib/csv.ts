import type { Survey } from '../types'
import { CODEBOOK } from './constants'

// CSV serialization for data export, in codebook column order, plus the
// self-describing data-dictionary export.

const CSV_COLUMNS: (keyof Survey)[] = [
  'id', 'fEta', 'nui', 'nuiEtr',
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

export function toCSV(surveys: Survey[]): string {
  // duracion_s: para-data interview duration in seconds (createdAt − startedAt),
  // a derived QC field for detecting implausibly fast (fabricated) interviews.
  //
  // medications is a SINGLE column: every stored product is packed into one cell
  // (products separated by '|', the five fields per product by ';', in the order
  // nmMed;dci;concMed;undConc;fVto). This mirrors the `medications` codebook entry
  // and keeps the header and every data row at the same column count — emitting
  // the five sub-fields as separate headers (as before) made the header wider
  // than the rows, shifting the medication data under the wrong column.
  const medHeader = 'medications'
  const header = [...CSV_COLUMNS, 'duracion_s', ...MOTIVE_COLUMNS, medHeader].join(',')
  const rows = surveys.map(s => {
    const base = CSV_COLUMNS.map(col => escapeCSV(s[col])).join(',')
    const durSec = s.startedAt && s.createdAt
      ? Math.round((new Date(s.createdAt).getTime() - new Date(s.startedAt).getTime()) / 1000)
      : null
    const dur = durSec != null && durSec >= 0 ? String(durSec) : ''
    const motives = MOTIVE_COLUMNS.map(col => escapeCSV(s[col])).join(',')
    const meds = s.medications?.length
      ? s.medications.map(m =>
          [m.nmMed, m.dci, m.concMed, m.undConc, m.fVto].map(escapeCSV).join(';'),
        ).join('|')
      : ''
    return `${base},${dur},${motives},${escapeCSV(meds)}`
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
