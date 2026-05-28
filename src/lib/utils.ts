import type { Survey, Medication, ProductMetrics } from '../types'

// ─── Date helpers ─────────────────────────────────────────────────────────

/**
 * Calcula edad en años completos entre fNac y fEta (F_ETA − F_NAC).
 * Coincide con la lógica Excel del codebook.
 */
export function calcEdad(fEta: string, fNac: string): number | null {
  if (!fEta || !fNac) return null
  const eta = new Date(fEta + 'T00:00:00')
  const nac = new Date(fNac + 'T00:00:00')
  if (isNaN(eta.getTime()) || isNaN(nac.getTime())) return null
  if (nac >= eta) return null
  let age = eta.getFullYear() - nac.getFullYear()
  const m = eta.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && eta.getDate() < nac.getDate())) age--
  return age < 0 || age > 130 ? null : age
}

/** Diferencia en días enteros (a − b). Espejo de la resta de fechas Excel. */
export function dayDiff(a: string, b: string): number | null {
  if (!a || !b) return null
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null
  return Math.round((da.getTime() - db.getTime()) / 86_400_000)
}

/**
 * Métricas de tiempo por producto (lógica Excel del codebook).
 * T_VTO  = F_ETA − F_VTO   (días vencido acumulado en hogar)
 * T_DISP = F_ETA − F_DISP  (ciclo total entrega → encuesta)
 * V_UTIL = F_VTO − F_DISP  (vida útil remanente al entregar)
 */
export function productMetrics(fEta: string, fDisp: string, med: Medication): ProductMetrics {
  const tVto  = dayDiff(fEta,  med.fVto)
  const tDisp = dayDiff(fEta,  fDisp)
  const vUtil = dayDiff(med.fVto, fDisp)
  return {
    tVto,
    tDisp,
    vUtil,
    isExpired: tVto !== null && tVto > 0,
  }
}

/** Formatea YYYY-MM-DD a DD/MM/YYYY para visualización. */
export function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Retorna hoy como YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** Formatea ISO timestamp a fecha/hora local legible. */
export function fmtTimestamp(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── UUID ─────────────────────────────────────────────────────────────────

export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ─── Numbers ──────────────────────────────────────────────────────────────

export const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0

export const safeNum = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0

// ─── Frequency table ──────────────────────────────────────────────────────

export function freqTable<T extends string>(
  surveys: Survey[],
  key: keyof Survey,
  options: readonly T[],
): { name: T; n: number }[] {
  return options.map(v => ({
    name: v,
    n: surveys.filter(s => s[key] === v).length,
  }))
}

/** Groups surveys by a string key and sums a numeric field. */
export function groupSum(
  surveys: Survey[],
  groupKey: keyof Survey,
  sumKey: keyof Survey,
): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const s of surveys) {
    const k = String(s[groupKey] ?? 'Sin dato') || 'Sin dato'
    map.set(k, (map.get(k) ?? 0) + ((s[sumKey] as number | null) ?? 0))
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

// ─── CSV export (codebook column order) ───────────────────────────────────

const CSV_COLUMNS: (keyof Survey)[] = [
  'id', 'fEta', 'nui', 'nuiEtr', 'fNac',
  'ciudad', 'dir', 'estrato',
  'etnia', 'asSalud', 'estLab', 'ingreso', 'nvEstu',
  'perSalud', 'estSalud', 'prbSalud', 'conMed', 'medPrc',
  'fPrc', 'fDisp', 'indMed',
  'medSob', 'dispMedVc', 'ctoDispVc', 'vtoMedNc',
  'cantMed', 'cantMedVto', 'pesoMedNc',
  'obs', 'createdAt', 'updatedAt',
]

function escapeCSV(value: unknown): string {
  const str = String(value ?? '')
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

export function toCSV(surveys: Survey[]): string {
  const medHeader = 'nmMed,dci,concMed,undConc,fVto'
  const header = [...CSV_COLUMNS, medHeader].join(',')
  const rows = surveys.map(s => {
    const base = CSV_COLUMNS.map(col => escapeCSV(s[col])).join(',')
    const meds = s.medications?.length
      ? s.medications.map(m =>
          [m.nmMed, m.dci, m.concMed, m.undConc, m.fVto].map(escapeCSV).join(';'),
        ).join('|')
      : ''
    return `${base},${escapeCSV(meds)}`
  })
  return '﻿' + [header, ...rows].join('\n')
}

// ─── Download ─────────────────────────────────────────────────────────────

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function dateTag(): string {
  return new Date().toISOString().slice(0, 10)
}
