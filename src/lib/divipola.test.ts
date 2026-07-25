import { describe, it, expect } from 'vitest'
import { DIVIPOLA } from './divipola.data'
import { searchMunicipios, DEPARTAMENTOS, lookupCodigo } from './divipola'

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

describe('cascade (department-scoped) search', () => {
  it('exposes the 33 departments, alphabetically', () => {
    expect(DEPARTAMENTOS.length).toBe(33)
    expect(DEPARTAMENTOS[0]).toBe('Amazonas')
    expect(DEPARTAMENTOS).toContain('Atlántico')
  })

  it('scoped to a department, an empty term lists only that department', () => {
    const atl = searchMunicipios('', 200, 'Atlántico')
    expect(atl.length).toBeGreaterThan(20)
    expect(atl.every(r => r.departamento === 'Atlántico')).toBe(true)
    expect(atl.map(r => r.municipio)).toContain('Barranquilla')
  })

  it('scoping prevents picking a same-named municipality from another department', () => {
    const inAtl = searchMunicipios('sabanalarga', 50, 'Atlántico')
    expect(inAtl.every(r => r.departamento === 'Atlántico')).toBe(true)
    const inCas = searchMunicipios('sabanalarga', 50, 'Casanare')
    expect(inCas.every(r => r.departamento === 'Casanare')).toBe(true)
  })
})

describe('lookupCodigo (RBQM R4 — código DANE para la FK)', () => {
  it('resuelve el código oficial DANE de un municipio inequívoco', () => {
    expect(lookupCodigo('Barranquilla', 'Atlántico')).toBe('08001')
    expect(lookupCodigo('Medellín', 'Antioquia')).toBe('05001')
  })
  it('es insensible a acentos/mayúsculas en el municipio', () => {
    expect(lookupCodigo('medellin', 'Antioquia')).toBe('05001')
  })
  it('desambigua homónimos por departamento', () => {
    const atl = lookupCodigo('Sabanalarga', 'Atlántico')
    const cas = lookupCodigo('Sabanalarga', 'Casanare')
    expect(atl).not.toBe('')
    expect(cas).not.toBe('')
    expect(atl).not.toBe(cas)
  })
  it('devuelve "" (→ NULL en la FK) cuando el par no resuelve unívocamente', () => {
    expect(lookupCodigo('', 'Atlántico')).toBe('')
    expect(lookupCodigo('Ciudad Inexistente', 'Atlántico')).toBe('')
    expect(lookupCodigo('Sabanalarga')).toBe('') // homónimo sin departamento
  })
})
