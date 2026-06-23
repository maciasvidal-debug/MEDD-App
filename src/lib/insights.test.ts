import { describe, it, expect } from 'vitest'
import { buildInsights, type InsightInput } from './insights'

const base: InsightInput = {
  n: 40, nSob: 30, nVenc: 10, nDisp: 6, unidTotal: 100, vencTotal: 25,
  assoc: null, surveyorEffect: null, adjusted: null, backcheck: null,
  retention: null, medStats: null, integrityCount: 0, tests: [], holm: [],
}

describe('buildInsights', () => {
  it('always leads with the base size and the headline expired-at-home prevalence', () => {
    const r = buildInsights(base)
    expect(r[0].id).toBe('base')
    const venc = r.find(i => i.id === 'venc')
    expect(venc?.text).toMatch(/25,0% de los hogares/) // 10/40, comma decimal
    expect(venc?.text).toMatch(/IC95%/)
  })

  it('warns on a small base (n < 30)', () => {
    expect(buildInsights({ ...base, n: 12 })[0].tone).toBe('warn')
  })

  it('warns when fewer than half of storers know how to dispose', () => {
    const r = buildInsights({ ...base, nSob: 30, nDisp: 6 }) // 20% know
    expect(r.find(i => i.id === 'almac')?.tone).toBe('warn')
  })

  it('flags integrity gaps as a warning', () => {
    const r = buildInsights({ ...base, integrityCount: 3 })
    const integ = r.find(i => i.id === 'integ')
    expect(integ?.tone).toBe('warn')
    expect(integ?.text).toMatch(/3 encuestas/)
  })

  it('reads a significant socioeconomic gradient and warns on sparse cells', () => {
    const r = buildInsights({
      ...base,
      assoc: { chi: { df: 2, p: 0.01, minExpected: 3 }, trend: { p: 0.02, direction: 'creciente' } },
    })
    const assoc = r.find(i => i.id === 'assoc')
    expect(assoc?.text).toMatch(/difiere por estrato/)
    expect(assoc?.text).toMatch(/gradiente creciente/)
    expect(r.find(i => i.id === 'assoc-cell')?.tone).toBe('warn')
  })

  it('flags confounding when the MH-adjusted estimate moves >10%', () => {
    const r = buildInsights({
      ...base,
      adjusted: { mh: { rr: 1.5, lo: 1.1, hi: 2.0 }, pctChange: 25, crude: { rr: 1.9 } },
    })
    const mh = r.find(i => i.id === 'mh')
    expect(mh?.tone).toBe('warn')
    expect(mh?.text).toMatch(/confunde/)
  })

  it('reports survivors of the Holm multiplicity correction', () => {
    const r = buildInsights({
      ...base,
      tests: [
        { key: 't1', label: 'Estrato × vencidos (χ²)', p: 0.001 },
        { key: 't2', label: 'Gradiente por estrato', p: 0.5 },
      ],
      holm: [
        { key: 't1', reject: true },
        { key: 't2', reject: false },
      ],
    })
    expect(r.find(i => i.id === 'holm')?.text).toMatch(/sobrevive: Estrato × vencidos/)
  })

  it('warns when no contrast survives multiplicity control', () => {
    const r = buildInsights({
      ...base,
      tests: [
        { key: 't1', label: 'A', p: 0.2 },
        { key: 't2', label: 'B', p: 0.3 },
      ],
      holm: [{ key: 't1', reject: false }, { key: 't2', reject: false }],
    })
    expect(r.find(i => i.id === 'holm')?.tone).toBe('warn')
  })
})
