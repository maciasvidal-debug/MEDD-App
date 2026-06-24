// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMunicipios } from './useMunicipios'

// The municipio combobox now resolves against the bundled DIVIPOLA catalogue
// (offline, synchronous) instead of a remote endpoint.
describe('useMunicipios', () => {
  it('returns nothing for terms shorter than 2 chars', () => {
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('a') })
    expect(result.current.results).toEqual([])
    expect(result.current.error).toBe('')
    expect(result.current.loading).toBe(false)
  })

  it('finds municipalities offline, accent/case-insensitive, with their department', () => {
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('barranq') })
    const hit = result.current.results.find(r => r.municipio === 'Barranquilla')
    expect(hit).toBeTruthy()
    expect(hit?.departamento).toBe('Atlántico')
  })

  it('disambiguates same-named municipalities by department (Sabanalarga)', () => {
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('sabanalarga') })
    const depts = result.current.results
      .filter(r => r.municipio === 'Sabanalarga')
      .map(r => r.departamento)
    expect(depts).toContain('Atlántico')
    expect(depts).toContain('Casanare')
  })

  it('clear() empties the results', () => {
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('bogota') })
    expect(result.current.results.length).toBeGreaterThan(0)
    act(() => { result.current.clear() })
    expect(result.current.results).toEqual([])
  })
})
