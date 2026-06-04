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
    const r = validateDraft(draft({ fEta: '2026-01-10', fNac: '1990-01-01', cantMed: 5, cantMedVto: 2 }))
    expect(r.errors).toHaveLength(0)
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
