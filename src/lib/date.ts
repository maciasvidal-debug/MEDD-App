import type { Medication, ProductMetrics } from '../types'

// Date & time helpers (Excel-codebook date arithmetic, display formatting, and
// the filename date tag used by the CSV exporters).

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

/**
 * Margen de caducidad CON SIGNO a la fecha de la entrevista (Sección 11.2, Cambio 3):
 *   margen = F_VTO − F_ETA  (días)
 * Positivo = días hasta el vencimiento (aún vigente); NEGATIVO = días desde que se
 * venció (ya vencido al momento de la encuesta). Es la variable continua que exigen
 * los modelos correctos del margen (regresión cuantílica de la mediana; MCO robusto):
 * INVARIANTE — se conserva el signo, NO se trunca en cero y NO se excluyen los
 * ítems vencidos (margen negativo). Devuelve null solo si falta alguna fecha.
 */
export function margenDias(fEta: string, fVto: string): number | null {
  return dayDiff(fVto, fEta)
}

/**
 * ¿El producto está vencido a la fecha de la entrevista? (F_ETA − F_VTO > 0).
 * Atajo de `productMetrics(...).isExpired` para los recorridos que sólo miran el
 * estado de vencimiento (agregados del dashboard, listado de encuestas, export):
 * calcula UNA sola resta de fechas en vez de tres, evitando T_DISP y V_UTIL —dos
 * pares de `new Date()` por producto— que allí se descartan. Misma semántica.
 */
export function isProductExpired(fEta: string, fVto: string): boolean {
  const tVto = dayDiff(fEta, fVto)
  return tVto !== null && tVto > 0
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

/** YYYY-MM-DD tag for export filenames. */
export function dateTag(): string {
  return new Date().toISOString().slice(0, 10)
}
