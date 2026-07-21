import { describe, it, expect } from 'vitest'
import { validateDraft } from './quality'
import { EMPTY_DRAFT } from './constants'
import type { SurveyDraft, Survey } from '../types'

function draft(over: Partial<SurveyDraft> = {}): SurveyDraft {
  return { ...EMPTY_DRAFT, ...over }
}

describe('validateDraft — hard errors', () => {
  it('flags birth date after the interview date', () => {
    const r = validateDraft(draft({ fEta: '2020-01-01', fNac: '2025-01-01' }))
    expect(r.errors.some(e => e.includes('fecha de nacimiento'))).toBe(true)
  })
  it('flags expired units exceeding unused units', () => {
    const r = validateDraft(draft({ cantMed: 3, cantMedVto: 5 }))
    expect(r.errors.some(e => e.includes('no pueden superar'))).toBe(true)
  })
  it('flags dispensing date after the interview', () => {
    const r = validateDraft(draft({ fEta: '2026-01-01', fDisp: '2026-02-01' }))
    expect(r.errors.some(e => e.includes('dispensación'))).toBe(true)
  })
  it('passes a coherent record with no errors', () => {
    const r = validateDraft(draft({
      fEta: '2026-01-10', fNac: '1990-01-01', cantMed: 5, cantMedVto: 2,
      // Expired units are declared, so a past-dated product must back them up.
      medications: [{ nmMed: 'X', dci: '', concMed: null, undConc: '', fVto: '2025-12-01' }],
    }))
    expect(r.errors).toHaveLength(0)
  })
})

describe('validateDraft — expired-without-detail integrity', () => {
  const expiredMed = { nmMed: 'X', dci: '', concMed: null, undConc: '' as const, fVto: '2025-12-01' }
  const liveMed    = { nmMed: 'Y', dci: '', concMed: null, undConc: '' as const, fVto: '2030-01-01' }

  it('errors when vtoMedNc is Sí but no product is expired', () => {
    const r = validateDraft(draft({ fEta: '2026-01-10', medSob: 'Sí', vtoMedNc: 'Sí' }))
    expect(r.errors.some(e => e.includes('ningún producto del detalle'))).toBe(true)
  })
  it('errors when expired units are counted but no product is expired', () => {
    const r = validateDraft(draft({ fEta: '2026-01-10', cantMed: 3, cantMedVto: 1, medications: [liveMed] }))
    expect(r.errors.some(e => e.includes('ningún producto del detalle'))).toBe(true)
  })
  it('passes when a past-dated product backs the declared expired meds', () => {
    const r = validateDraft(draft({ fEta: '2026-01-10', vtoMedNc: 'Sí', cantMedVto: 1, medications: [expiredMed] }))
    expect(r.errors.some(e => e.includes('ningún producto del detalle'))).toBe(false)
  })
  it('does not fire when no expired meds are declared', () => {
    const r = validateDraft(draft({ fEta: '2026-01-10', medSob: 'Sí', vtoMedNc: 'No', cantMedVto: 0 }))
    expect(r.errors.some(e => e.includes('ningún producto del detalle'))).toBe(false)
  })
})

describe('validateDraft — warnings', () => {
  it('warns on an implausible weight', () => {
    const r = validateDraft(draft({ pesoMedNc: 9000 }))
    expect(r.warnings.some(w => w.includes('Peso'))).toBe(true)
  })
  it('warns when a medication expired before it was dispensed', () => {
    const r = validateDraft(draft({
      fEta: '2026-06-01', fDisp: '2026-05-01',
      medications: [{ nmMed: 'X', dci: '', concMed: null, undConc: '', fVto: '2026-04-01' }],
    }))
    expect(r.warnings.some(w => w.includes('vida útil negativa'))).toBe(true)
  })
})

describe('validateDraft — completeness & duplicates', () => {
  it('reports higher completeness as more fields are filled', () => {
    const low = validateDraft(draft()).completeness
    const high = validateDraft(draft({
      fEta: '2026-01-01', nuiEtr: 1, fNac: '1990-01-01', ciudad: 'Bogotá',
      estrato: 3, etnia: 'Ninguna', asSalud: 'Contributivo', estLab: 'Empleado',
      ingreso: '1-3 SMMLV', nvEstu: 'Profesional', perSalud: 'Buena', estSalud: 'No',
      medSob: 'No',
    })).completeness
    expect(high).toBeGreaterThan(low)
    expect(high).toBe(100)
  })
  it('detects a likely duplicate by respondent fingerprint, ignoring the edited row', () => {
    const existing = [{
      id: 'x', fNac: '1990-01-01', ciudad: 'Cali', fEta: '2026-03-03',
    } as unknown as Survey]
    const d = draft({ fNac: '1990-01-01', ciudad: 'Cali', fEta: '2026-03-03' })
    expect(validateDraft(d, existing).duplicate?.id).toBe('x')
    expect(validateDraft(d, existing, 'x').duplicate).toBeNull()
  })
})

// Threshold/boundary checks: the soft warnings use hardcoded cut-offs, so test
// just-over (warns) and exactly-at (does not warn) for each.
describe('validateDraft — warning thresholds', () => {
  const hasWeight = (r: { warnings: string[] }) => r.warnings.some(w => w.includes('Peso'))
  const hasAge    = (r: { errors: string[] })   => r.errors.some(e => e.includes('Edad implausible'))

  it('warns on weight strictly above 5000 g, not at the boundary', () => {
    expect(hasWeight(validateDraft(draft({ pesoMedNc: 5001 })))).toBe(true)
    expect(hasWeight(validateDraft(draft({ pesoMedNc: 5000 })))).toBe(false)
    expect(hasWeight(validateDraft(draft({ pesoMedNc: 0 })))).toBe(false)
  })

  it('blocks (hard error) on an implausible age (> 110), not a soft warning (Rec. 2)', () => {
    // Interview long after birth → age > 110.
    expect(hasAge(validateDraft(draft({ fEta: '2026-01-01', fNac: '1900-01-01' })))).toBe(true)
    // A plausible adult age does not error.
    expect(hasAge(validateDraft(draft({ fEta: '2026-01-01', fNac: '1990-01-01' })))).toBe(false)
  })

  it('warns when a medication is expired by more than 10 years', () => {
    const med = (fVto: string) => ({ nmMed: 'X', dci: '', concMed: null, undConc: '' as const, fVto })
    // fEta - fVto > 3650 days.
    const over = validateDraft(draft({ fEta: '2026-01-01', medications: [med('2010-01-01')] }))
    expect(over.warnings.some(w => w.includes('más de 10 años'))).toBe(true)
    // Recently expired does not trigger the 10-year warning.
    const recent = validateDraft(draft({ fEta: '2026-01-01', medications: [med('2025-12-01')] }))
    expect(recent.warnings.some(w => w.includes('más de 10 años'))).toBe(false)
  })

  it('warns when "vencidos en casa" is Sí but the expired count is 0/missing', () => {
    expect(validateDraft(draft({ medSob: 'Sí', vtoMedNc: 'Sí', cantMedVto: 0 }))
      .warnings.some(w => w.includes('cantidad de vencidos es 0'))).toBe(true)
    expect(validateDraft(draft({ medSob: 'Sí', vtoMedNc: 'Sí', cantMedVto: null }))
      .warnings.some(w => w.includes('cantidad de vencidos es 0'))).toBe(true)
    // With a positive count, no inconsistency warning.
    expect(validateDraft(draft({ medSob: 'Sí', vtoMedNc: 'Sí', cantMed: 5, cantMedVto: 2 }))
      .warnings.some(w => w.includes('cantidad de vencidos es 0'))).toBe(false)
  })

  it('warns when dispensation precedes prescription', () => {
    const r = validateDraft(draft({ fPrc: '2026-02-01', fDisp: '2026-01-01' }))
    expect(r.warnings.some(w => w.includes('anterior a la prescripción'))).toBe(true)
  })
})

describe('validateDraft — completeness conditionals', () => {
  it('does not count medication sub-fields when medSob is not "Sí"', () => {
    // Same answered fields, but medSob 'No' has a smaller denominator than 'Sí'
    // (which adds vtoMedNc/cantMed/medications), so 'No' scores higher here.
    const base: Partial<SurveyDraft> = {
      fEta: '2026-01-01', nuiEtr: 1, fNac: '1990-01-01', ciudad: 'Bogotá',
      estrato: 3, etnia: 'Ninguna', asSalud: 'Contributivo', estLab: 'Empleado',
      ingreso: '1-3 SMMLV', nvEstu: 'Profesional', perSalud: 'Buena', estSalud: 'No',
    }
    const no  = validateDraft(draft({ ...base, medSob: 'No' })).completeness
    const si  = validateDraft(draft({ ...base, medSob: 'Sí' })).completeness
    expect(no).toBe(100)
    expect(si).toBeLessThan(100)
  })
})
