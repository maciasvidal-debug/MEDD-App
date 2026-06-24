import { describe, it, expect } from 'vitest'
import { DIVIPOLA } from './divipola.data'
import { searchMunicipios } from './divipola'

describe('DIVIPOLA catalogue', () => {
  it('bundles the full DANE catalogue (1,122 entries) with clean fields', () => {
    expect(DIVIPOLA.length).toBe(1122)
    for (const [m, d, c] of DIVIPOLA) {
      expect(m).toBeTruthy()
      expect(d).toBeTruthy()
      expect(c).toMatch(/^\d{5}$/)
      // no leftover type tokens from the source PDF
      expect(m).not.toMatch(/Municipio|Isla|[ÁA]rea/)
    }
  })

  it('codes are unique and the department matches the DANE code prefix', () => {
    const byCode = new Map(DIVIPOLA.map(([, , c]) => [c, true]))
    expect(byCode.size).toBe(DIVIPOLA.length)
    const atl = DIVIPOLA.filter(([, , c]) => c.startsWith('08'))
    expect(atl.every(([, d]) => d === 'Atlántico')).toBe(true)
  })
})

describe('searchMunicipios', () => {
  it('matches accent/case-insensitively and ranks prefixes first', () => {
    const r = searchMunicipios('BARRANQ')
    expect(r[0].municipio).toBe('Barranquilla')
    expect(r[0].departamento).toBe('Atlántico')
    expect(r[0].codigo).toBe('08001')
  })

  it('returns nothing under 2 chars and caps the result count', () => {
    expect(searchMunicipios('a')).toEqual([])
    expect(searchMunicipios('san', 5).length).toBeLessThanOrEqual(5)
  })
})
