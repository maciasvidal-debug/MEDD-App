import { describe, it, expect } from 'vitest'
import { normalizeCiudad, ciudadKey, fold } from './ciudad'

describe('normalizeCiudad', () => {
  it('title-cases bare municipalities regardless of input casing', () => {
    expect(normalizeCiudad('MALAMBO').municipio).toBe('Malambo')
    expect(normalizeCiudad('barranquilla').municipio).toBe('Barranquilla')
    expect(normalizeCiudad('BARRANQUILLA').municipio).toBe('Barranquilla')
    expect(normalizeCiudad('soledad').municipio).toBe('Soledad')
    expect(normalizeCiudad('puerto colombia').municipio).toBe('Puerto Colombia')
  })

  it('strips an appended department across every separator seen in the field', () => {
    expect(normalizeCiudad('Barranquilla ,Atlántico')).toEqual({ municipio: 'Barranquilla', departamento: 'Atlántico' })
    expect(normalizeCiudad('barranquilla atlantico').municipio).toBe('Barranquilla')
    expect(normalizeCiudad('Polonuevo-Atlantico').municipio).toBe('Polonuevo')
    expect(normalizeCiudad('Atlántico/Barranquilla').municipio).toBe('Barranquilla')
    expect(normalizeCiudad('Sabanalarga Atlantico').municipio).toBe('Sabanalarga')
    expect(normalizeCiudad('Soledad Atlantico').municipio).toBe('Soledad')
  })

  it('never strips a single bare token that coincides with a department name', () => {
    // "Córdoba" is also a department, but as a lone municipality it must survive.
    // (Accents aren't invented — only existing ones are preserved — but folding
    // still groups the variants together, see ciudadKey below.)
    expect(normalizeCiudad('Córdoba').municipio).toBe('Córdoba')
    expect(normalizeCiudad('cordoba').municipio).toBe('Cordoba')
    expect(ciudadKey('Córdoba')).toBe(ciudadKey('cordoba'))
  })

  it('keeps multi-word municipalities whose tail is not a department', () => {
    expect(normalizeCiudad('Santander de Quilichao').municipio).toBe('Santander de Quilichao')
  })

  it('collapses stray whitespace and returns empty for blanks', () => {
    expect(normalizeCiudad('  Barranquilla   ').municipio).toBe('Barranquilla')
    expect(normalizeCiudad('')).toEqual({ municipio: '', departamento: '' })
    expect(normalizeCiudad(null)).toEqual({ municipio: '', departamento: '' })
  })
})

describe('ciudadKey', () => {
  it('folds every observed spelling of one municipality to a single key', () => {
    const forms = [
      'Barranquilla', 'BARRANQUILLA', 'barranquilla atlantico',
      'Barranquilla ,Atlántico', 'Atlántico/Barranquilla',
    ]
    const keys = new Set(forms.map(ciudadKey))
    expect(keys).toEqual(new Set(['barranquilla']))
  })

  it('keeps genuinely different municipalities apart', () => {
    expect(ciudadKey('Soledad')).not.toBe(ciudadKey('Sabanalarga'))
    expect(ciudadKey('Malambo')).toBe('malambo')
  })

  it('is empty for blank input', () => {
    expect(ciudadKey('')).toBe('')
  })
})

describe('fold', () => {
  it('removes diacritics and lowercases', () => {
    expect(fold('Atlántico')).toBe('atlantico')
    expect(fold('  NARIÑO ')).toBe('narino')
  })
})
