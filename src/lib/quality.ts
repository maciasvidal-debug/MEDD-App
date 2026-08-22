import type { SurveyDraft, Survey } from '../types'
import { calcEdad, dayDiff, productMetrics, isProductExpired } from './date'

export interface QualityReport {
  errors:       string[]  // hard logical impossibilities → block save
  warnings:     string[]  // soft plausibility flags → allow but surface
  completeness: number    // 0..100, fraction of key fields filled
  duplicate:    Survey | null
}

// Key fields that meaningfully define a complete record (used for the
// completeness indicator). Conditionals are only counted when applicable.
function completenessOf(d: SurveyDraft): number {
  const filled = (v: unknown) => v !== '' && v !== null && v !== undefined
  const fields: boolean[] = [
    filled(d.fEta), filled(d.nuiEtr), filled(d.fNac), filled(d.ciudad),
    filled(d.estrato), filled(d.etnia), filled(d.asSalud), filled(d.estLab),
    filled(d.ingreso), filled(d.nvEstu), filled(d.perSalud), filled(d.estSalud),
    filled(d.medSob),
  ]
  if (d.medSob === 'Sí') {
    fields.push(filled(d.vtoMedNc), filled(d.cantMed), d.medications.length > 0)
  }
  const done = fields.filter(Boolean).length
  return Math.round((done / fields.length) * 100)
}

/**
 * True when the record declares expired medicines in the home — either the
 * direct-observation flag (vtoMedNc='Sí') or a positive expired-unit count
 * (cantMedVto>0) — yet no medication entry carries a past expiry date, so the
 * expired product(s) were never detailed. This is the data-integrity gap that
 * lets "has expired meds" surveys exist with no expired-product evidence.
 * Reused by the wizard's pre-save check (hard error) and the investigator QC
 * report, so both flag the exact same condition.
 */
export function declaresExpiredWithoutDetail(
  d: Pick<SurveyDraft, 'fEta' | 'fDisp' | 'vtoMedNc' | 'cantMedVto' | 'medications'>,
): boolean {
  const declaresExpired = d.vtoMedNc === 'Sí' || (d.cantMedVto ?? 0) > 0
  if (!declaresExpired) return false
  const hasExpiredDetail = (d.medications ?? []).some(
    m => isProductExpired(d.fEta, m.fVto),
  )
  return !hasExpiredDetail
}

/**
 * Cross-field data-quality check run before a survey is saved. `errors` are
 * logical impossibilities that should block the save; `warnings` are
 * plausibility flags that are surfaced but don't block. `duplicate` is a likely
 * prior record (same respondent fingerprint), excluding the row being edited.
 */
// Hard logical impossibilities that should block the save.
function collectErrors(d: SurveyDraft): string[] {
  const errors: string[] = []
  if (d.fNac && d.fEta) {
    const age = dayDiff(d.fEta, d.fNac)
    if (age != null && age <= 0) errors.push('La fecha de nacimiento es posterior (o igual) a la de la entrevista.')
  }
  // Edad implausible = bloqueo (Rec. 2): la edad derivada debe caer en [0,110].
  // El piloto exportó edades derivadas ≈0 y fechas incoherentes; validarlo en
  // captura (error, no solo warning) impide que el registro entre.
  const edadErr = calcEdad(d.fEta, d.fNac)
  if (edadErr != null && (edadErr < 0 || edadErr > 110)) {
    errors.push(`Edad implausible (${edadErr} años): verifique las fechas de nacimiento y entrevista.`)
  }
  if (d.fDisp && d.fEta) {
    const diff = dayDiff(d.fEta, d.fDisp)
    if (diff != null && diff < 0) errors.push('La fecha de dispensación es posterior a la de la entrevista.')
  }
  if (d.cantMed != null && d.cantMedVto != null && d.cantMedVto > d.cantMed) {
    errors.push('Las unidades vencidas no pueden superar las unidades sin consumir.')
  }
  if (declaresExpiredWithoutDetail(d)) {
    errors.push('Indicó medicamentos vencidos en casa, pero ningún producto del detalle tiene fecha de vencimiento pasada. Agregue el/los producto(s) vencido(s) con su fecha de vencimiento en el paso de Medicamentos.')
  }
  return errors
}

// Soft plausibility flags that are surfaced but don't block the save.
function collectWarnings(d: SurveyDraft): string[] {
  const warnings: string[] = []
  // Edad implausible se trató como ERROR en collectErrors (Rec. 2); aquí solo
  // quedan las plausibilidades blandas.
  if (d.pesoMedNc != null && d.pesoMedNc > 5000) warnings.push(`Peso muy alto (${d.pesoMedNc} g): confirme la unidad (gramos).`)
  if (d.fPrc && d.fDisp) {
    const diff = dayDiff(d.fDisp, d.fPrc)
    if (diff != null && diff < 0) warnings.push('La dispensación es anterior a la prescripción: verifique las fechas.')
  }
  d.medications.forEach((m, i) => {
    const mx = productMetrics(d.fEta, d.fDisp, m)
    if (mx.vUtil != null && mx.vUtil < 0) {
      warnings.push(`Medicamento ${i + 1}: vencía antes de ser dispensado (vida útil negativa).`)
    }
    if (mx.tVto != null && mx.tVto > 3650) {
      warnings.push(`Medicamento ${i + 1}: vencido hace más de 10 años: verifique la fecha.`)
    }
  })
  if (d.medSob === 'Sí' && d.vtoMedNc === 'Sí' && (d.cantMedVto == null || d.cantMedVto === 0)) {
    warnings.push('Indicó vencidos en casa pero la cantidad de vencidos es 0.')
  }
  return warnings
}

// Cache for grouping surveys by their composite fingerprint. Using a WeakMap
// keyed by the existing array ensures that the index is automatically garbage
// collected when the array reference changes and prevents memory leaks.
const duplicateIndexCache = new WeakMap<Survey[], Map<string, Survey[]>>()

function getSurveyFingerprint(s: Pick<Survey, 'fNac' | 'ciudad' | 'fEta'>): string {
  return `${s.fNac}|${s.ciudad}|${s.fEta}`
}

// Likely prior record (same respondent fingerprint), excluding the edited row.
function findDuplicate(d: SurveyDraft, existing: Survey[], editingId?: string): Survey | null {
  if (!(d.fNac && d.ciudad && d.fEta)) return null

  let index = duplicateIndexCache.get(existing)
  if (!index) {
    index = new Map<string, Survey[]>()
    for (const s of existing) {
      if (!(s.fNac && s.ciudad && s.fEta)) continue
      const key = getSurveyFingerprint(s)
      const group = index.get(key)
      if (group) {
        group.push(s)
      } else {
        index.set(key, [s])
      }
    }
    duplicateIndexCache.set(existing, index)
  }

  const key = getSurveyFingerprint(d as Pick<SurveyDraft, 'fNac' | 'ciudad' | 'fEta'>)
  const matches = index.get(key)
  if (!matches) return null

  // Find the first match that isn't the currently edited survey
  return matches.find(s => s.id !== editingId) ?? null
}

export function validateDraft(
  d: SurveyDraft,
  existing: Survey[] = [],
  editingId?: string,
): QualityReport {
  return {
    errors:       collectErrors(d),
    warnings:     collectWarnings(d),
    completeness: completenessOf(d),
    duplicate:    findDuplicate(d, existing, editingId),
  }
}
