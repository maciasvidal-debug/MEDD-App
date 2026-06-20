import type { SurveyDraft, Survey } from '../types'
import { calcEdad, dayDiff, productMetrics } from './utils'

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
    m => productMetrics(d.fEta, d.fDisp, m).isExpired,
  )
  return !hasExpiredDetail
}

/**
 * Cross-field data-quality check run before a survey is saved. `errors` are
 * logical impossibilities that should block the save; `warnings` are
 * plausibility flags that are surfaced but don't block. `duplicate` is a likely
 * prior record (same respondent fingerprint), excluding the row being edited.
 */
export function validateDraft(
  d: SurveyDraft,
  existing: Survey[] = [],
  editingId?: string,
): QualityReport {
  const errors: string[] = []
  const warnings: string[] = []

  // — Hard logical impossibilities —
  if (d.fNac && d.fEta) {
    const age = dayDiff(d.fEta, d.fNac)
    if (age != null && age <= 0) errors.push('La fecha de nacimiento es posterior (o igual) a la de la entrevista.')
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

  // — Soft plausibility —
  const edad = calcEdad(d.fEta, d.fNac)
  if (edad != null && (edad < 0 || edad > 110)) warnings.push(`Edad atípica (${edad} años): verifique las fechas.`)
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

  // — Likely duplicate (same respondent fingerprint) —
  const duplicate = (d.fNac && d.ciudad && d.fEta)
    ? existing.find(s =>
        s.id !== editingId &&
        s.fNac === d.fNac && s.ciudad === d.ciudad && s.fEta === d.fEta,
      ) ?? null
    : null

  return { errors, warnings, completeness: completenessOf(d), duplicate }
}
