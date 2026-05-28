import type { Survey } from '../types'

// ─── Date ─────────────────────────────────────────────────────────────────────

/** Calcula edad en años a partir de YYYY-MM-DD. Retorna null si inválido. */
export function calcEdad(fechaNac: string): number | null {
  if (!fechaNac) return null
  const nac = new Date(fechaNac)
  if (isNaN(nac.getTime())) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad < 0 || edad > 120 ? null : edad
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

/** Formatea un ISO timestamp a fecha/hora local legible. */
export function fmtTimestamp(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── UUID ─────────────────────────────────────────────────────────────────────

/** UUID v4 usando crypto.randomUUID cuando está disponible. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback para contextos sin crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ─── Numbers ──────────────────────────────────────────────────────────────────

export const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0

export const safeNum = (v: string | number | null | undefined): number =>
  typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_COLUMNS: (keyof Survey)[] = [
  'id', 'fechaEncuesta', 'nui', 'nuiEncuestador', 'fechaNac',
  'etnia', 'eps', 'labor', 'ingreso', 'educ',
  'perSalud', 'estSalud', 'prbSalud', 'conMed', 'medPrc', 'indMed',
  'medSob', 'dispVenc', 'ctoDisp', 'hayVenc',
  'cantMed', 'cantVenc', 'pesoMed',
  'nmMed', 'dci', 'concMed', 'undConc',
  'obs', 'createdAt', 'updatedAt',
]

function escapeCSV(value: unknown): string {
  const str = String(value ?? '')
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

export function toCSV(surveys: Survey[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows = surveys.map(s =>
    CSV_COLUMNS.map(col => escapeCSV(s[col])).join(',')
  )
  return '\uFEFF' + [header, ...rows].join('\n')  // BOM para Excel
}

// ─── Download ─────────────────────────────────────────────────────────────────

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function dateTag(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Frequency table ──────────────────────────────────────────────────────────

export function freqTable<T extends string>(
  surveys: Survey[],
  key: keyof Survey,
  options: readonly T[]
): { name: T; n: number }[] {
  return options.map(v => ({
    name: v,
    n: surveys.filter(s => s[key] === v).length,
  }))
}
