import { describe, it, expect } from 'vitest'
import {
  buildRetention, buildEstratoAssociation, buildSurveyorEffect, buildSurveyorQC,
  buildMedicationStats, buildMotiveStats, buildDisposalStats, buildClassMotiveCross,
  buildBackcheckAgreement, buildEstratoAdjusted,
} from './dashboard-metrics'
import type { Survey, Medication, EtrPrograma } from '../types'

// Minimal Survey factory (mirrors pages/Dashboard.test.tsx). Only the fields a
// given build* function reads need to be set per case.
const mkSurvey = (over: Partial<Survey> = {}): Survey => ({
  id: Math.random().toString(36).slice(2),
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  nui: 1, fEta: '2026-02-01', fNac: '1990-01-01', fDisp: '2026-01-01',
  ciudad: 'Bogotá', estrato: 3, asSalud: 'Contributivo',
  medSob: 'No', vtoMedNc: 'No', cantMed: 0, cantMedVto: 0,
  medications: [], syncStatus: 'synced', ...over,
}) as unknown as Survey

const med = (over: Partial<Medication> = {}): Medication => ({
  nmMed: 'X', dci: '', concMed: null, undConc: '', fVto: '2027-01-01', ...over,
}) as unknown as Medication

describe('buildRetention', () => {
  it('returns null when no product is expired', () => {
    expect(buildRetention([mkSurvey({ medications: [med({ fVto: '2030-01-01' })] })])).toBeNull()
  })

  it('summarises the days-overdue distribution (R type-7 quantiles)', () => {
    // fEta 2026-02-01 minus fVto → 10, 20, 30 days overdue.
    const s = mkSurvey({
      fEta: '2026-02-01', fDisp: '2026-01-01',
      medications: [
        med({ fVto: '2026-01-22' }), // 10
        med({ fVto: '2026-01-12' }), // 20
        med({ fVto: '2026-01-02' }), // 30
      ],
    })
    const r = buildRetention([s])!
    expect(r).not.toBeNull()
    expect(r.n).toBe(3)
    expect(r.median).toBe(20)
    expect(r.q1).toBe(15)
    expect(r.q3).toBe(25)
    expect(r.p90).toBeCloseTo(28, 6)
    expect(r.max).toBe(30)
  })
})

describe('buildEstratoAssociation', () => {
  it('returns null with fewer than two present bands', () => {
    expect(buildEstratoAssociation([mkSurvey({ estrato: 3 }), mkSurvey({ estrato: 4 })])).toBeNull()
  })

  it('compares expired-at-home prevalence across estrato bands, ref = lowest', () => {
    const surveys = [
      ...Array.from({ length: 4 }, (_, i) => mkSurvey({ estrato: 1, vtoMedNc: i < 3 ? 'Sí' : 'No' })), // 3/4
      ...Array.from({ length: 4 }, (_, i) => mkSurvey({ estrato: 5, vtoMedNc: i < 1 ? 'Sí' : 'No' })), // 1/4
    ]
    const a = buildEstratoAssociation(surveys)!
    expect(a).not.toBeNull()
    expect(a.groups).toHaveLength(2)
    expect(a.ref).toBe('bajo (1–2)')
    expect(a.groups[0].rr.ref).toBe(true)   // reference group
    expect(a.groups[0].cases).toBe(3)
    expect(a.groups[0].total).toBe(4)
    expect(a.chi.df).toBe(1)
  })
})

describe('buildSurveyorEffect', () => {
  it('returns null when no surveyor-profile fields are present', () => {
    expect(buildSurveyorEffect([mkSurvey(), mkSurvey()])).toBeNull()
  })

  it('breaks the outcome down by surveyor program with a reference', () => {
    const surveys = [
      mkSurvey({ etrPrograma: 'Regencia en Farmacia', vtoMedNc: 'Sí' }),
      mkSurvey({ etrPrograma: 'Regencia en Farmacia', vtoMedNc: 'No' }),
      mkSurvey({ etrPrograma: 'Regencia en Farmacia', vtoMedNc: 'No' }),
      mkSurvey({ etrPrograma: 'Enfermería', vtoMedNc: 'Sí' }),
    ]
    const e = buildSurveyorEffect(surveys)!
    expect(e).not.toBeNull()
    expect(e.programs).not.toBeNull()
    expect(e.programs!.map(p => p.label).sort()).toEqual(['Enfermería', 'Regencia en Farmacia'])
    expect(e.ref).toBe('Regencia en Farmacia') // most-sampled program
    expect(e.chi!.df).toBe(1)
  })
})

describe('buildSurveyorQC', () => {
  it('returns null when no survey carries a surveyor id', () => {
    expect(buildSurveyorQC([mkSurvey()])).toBeNull()
  })

  it('flags an implausibly fast interview and reports the pool outcome rate', () => {
    const surveys = [
      // 60s interview (< FAST_SECONDS 120) → fast
      mkSurvey({ nuiEtr: 42, vtoMedNc: 'Sí',
        startedAt: '2026-01-01T00:01:00.000Z', createdAt: '2026-01-01T00:02:00.000Z' }),
      mkSurvey({ nuiEtr: 42, vtoMedNc: 'No',
        startedAt: '2026-01-01T00:01:00.000Z', createdAt: '2026-01-01T00:12:00.000Z' }),
    ]
    const qc = buildSurveyorQC(surveys)!
    expect(qc).not.toBeNull()
    expect(qc.rows).toHaveLength(1)
    expect(qc.rows[0].nuiEtr).toBe(42)
    expect(qc.rows[0].n).toBe(2)
    expect(qc.rows[0].fastCount).toBe(1)
    expect(qc.poolVencPct).toBeCloseTo(0.5, 10)
    expect(qc.digit).toBeNull() // < 20 weight values
  })
})

describe('buildMedicationStats', () => {
  it('returns null when there are no stored products', () => {
    expect(buildMedicationStats([mkSurvey({ medications: [] })])).toBeNull()
  })

  it('aggregates product-level counts and therapeutic classification', () => {
    const s = mkSurvey({
      fEta: '2026-02-01', fDisp: '2026-01-01',
      medications: [
        med({ nmMed: 'Amoxal', dci: 'amoxicilina', fVto: '2026-01-15' }), // expired, classified
        med({ nmMed: 'Amoxal', dci: 'amoxicilina', fVto: '2030-01-01' }), // not expired
      ],
    })
    const m = buildMedicationStats([s])!
    expect(m).not.toBeNull()
    expect(m.totalProducts).toBe(2)
    expect(m.expiredProducts).toBe(1)
    expect(m.distinctDci).toBe(1)
    expect(m.classifiedPct).toBe(100) // both amoxicilina → classified
    expect(m.topDci[0]).toEqual({ name: 'amoxicilina', n: 2 })
    expect(m.byGroup.length).toBeGreaterThan(0)
  })
})

describe('buildMotiveStats', () => {
  it('returns null when no v2 record with stored meds was asked', () => {
    expect(buildMotiveStats([mkSurvey({ instrumentVersion: 1, medSob: 'Sí' } as Partial<Survey>)])).toBeNull()
  })

  it('scopes denominators to asked records and counts multi-selects', () => {
    const surveys = [
      mkSurvey({ instrumentVersion: 2, medSob: 'Sí', conocePuntos: 'Sí',
        motNoConsumo: ['Automedicación', 'Sobró de la dosis'] } as Partial<Survey>),
      mkSurvey({ instrumentVersion: 1, medSob: 'Sí' } as Partial<Survey>), // v1 → not asked
    ]
    const m = buildMotiveStats(surveys)!
    expect(m).not.toBeNull()
    expect(m.nAsked).toBe(1)
    expect(m.nNotAsked).toBe(1)
    expect(m.conoceSi).toBe(1)
    expect(m.conoceBase).toBe(1)
    expect(m.noConsumo.find(x => x.name === 'Automedicación')!.n).toBe(1)
  })
})

describe('buildDisposalStats', () => {
  it('returns null when no storing home carries disposal info', () => {
    expect(buildDisposalStats([mkSurvey({ medSob: 'No' })])).toBeNull()
  })

  it('counts structured (v2) disposal categories', () => {
    const surveys = [
      mkSurvey({ medSob: 'Sí', dispFinal: ['Basura'] } as Partial<Survey>),
      mkSurvey({ medSob: 'Sí', dispFinal: ['Basura', 'Los guarda'] } as Partial<Survey>),
    ]
    const d = buildDisposalStats(surveys)!
    expect(d).not.toBeNull()
    expect(d.base).toBe(2)
    expect(d.fromStructured).toBe(2)
    expect(d.byCategory.find(c => c.name === 'Basura')!.n).toBe(2)
  })
})

describe('buildClassMotiveCross', () => {
  it('returns null with no classified asked household', () => {
    expect(buildClassMotiveCross([mkSurvey({ instrumentVersion: 2, medSob: 'Sí' } as Partial<Survey>)])).toBeNull()
  })

  it('cross-tabulates therapeutic group against non-consumption motives', () => {
    const s = mkSurvey({
      instrumentVersion: 2, medSob: 'Sí',
      motNoConsumo: ['Automedicación'],
      medications: [med({ dci: 'amoxicilina' })],
    } as Partial<Survey>)
    const c = buildClassMotiveCross([s])!
    expect(c).not.toBeNull()
    expect(c.nBase).toBe(1)
    expect(c.motives).toContain('Automedicación')
    expect(c.rows).toHaveLength(1)
    expect(c.rows[0].base).toBe(1)
    expect(c.rows[0].counts[c.motives.indexOf('Automedicación')]).toBe(1)
  })
})

describe('buildBackcheckAgreement', () => {
  it('returns null when there are no back-check pairs', () => {
    expect(buildBackcheckAgreement([mkSurvey(), mkSurvey()])).toBeNull()
  })

  it('pairs a back-check with its original and measures agreement', () => {
    const orig = mkSurvey({ id: 'orig', medSob: 'Sí', vtoMedNc: 'Sí', pesoMedNc: 100 } as Partial<Survey>)
    const back = mkSurvey({ id: 'bc', backcheckOf: 'orig', medSob: 'Sí', vtoMedNc: 'Sí', pesoMedNc: 110 } as Partial<Survey>)
    const a = buildBackcheckAgreement([orig, back])!
    expect(a).not.toBeNull()
    expect(a.nPairs).toBe(1)
    expect(a.pesoMAD).toBeCloseTo(10, 6)
    expect(a.catAgreement).not.toBeNull()
  })
})

describe('buildEstratoAdjusted', () => {
  it('returns null with fewer than two program strata', () => {
    expect(buildEstratoAdjusted([mkSurvey({ estrato: 5, etrPrograma: 'Medicina', vtoMedNc: 'Sí' })])).toBeNull()
  })

  it('produces a Mantel–Haenszel adjusted estimate across program strata', () => {
    // Two programs, each a full 2×2 over estrato-high (≥3) × outcome.
    const strata = (prog: EtrPrograma) => [
      mkSurvey({ etrPrograma: prog, estrato: 5, vtoMedNc: 'Sí' }), // high, case  (a)
      mkSurvey({ etrPrograma: prog, estrato: 5, vtoMedNc: 'No' }), // high, non   (b)
      mkSurvey({ etrPrograma: prog, estrato: 1, vtoMedNc: 'Sí' }), // low, case   (c)
      mkSurvey({ etrPrograma: prog, estrato: 1, vtoMedNc: 'No' }), // low, non    (d)
    ]
    const adj = buildEstratoAdjusted([...strata('Medicina'), ...strata('Enfermería')])!
    expect(adj).not.toBeNull()
    expect(adj.mh.strata).toBe(2)
    expect(Number.isFinite(adj.crude.rr)).toBe(true)
    expect(Number.isFinite(adj.mh.rr)).toBe(true)
    expect(adj.exposedTotal).toBe(4)   // 2 high per program × 2 programs
    expect(adj.unexposedTotal).toBe(4)
    expect(typeof adj.pctChange).toBe('number')
  })
})
