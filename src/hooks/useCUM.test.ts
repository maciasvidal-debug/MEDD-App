// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCUM } from './useCUM'
import type { CUMRecord } from '../types'

const rec = (over: Partial<CUMRecord> = {}): CUMRecord => ({
  producto: 'A', principioactivo: 'x', concentracion: '500',
  unidadmedida: 'mg', formafarmaceutica: 'TAB', ...over,
})

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok, status, json: async () => data,
  } as Response)
}

afterEach(() => vi.restoreAllMocks())

describe('useCUM', () => {
  it('ignores terms shorter than 3 chars (no fetch, no loading)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useCUM())
    await act(async () => { await result.current.search('ab') })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.searched).toBe(false)
  })

  it('fetches and dedupes by producto|principioactivo|concentracion', async () => {
    mockFetch([rec(), rec(), rec({ producto: 'B' })])
    const { result } = renderHook(() => useCUM())
    await act(async () => { await result.current.search('ace') })
    expect(result.current.results).toHaveLength(2)
    expect(result.current.searched).toBe(true)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('uppercases the term and escapes single quotes in the $where clause', async () => {
    const fetchSpy = mockFetch([])
    const { result } = renderHook(() => useCUM())
    await act(async () => { await result.current.search("l'or") })
    const url = decodeURIComponent(String(fetchSpy.mock.calls[0][0]))
    expect(url).toContain("%L''OR%")
  })

  it('escapes SoQL wildcard characters (% and _) in the $where clause', async () => {
    const fetchSpy = mockFetch([])
    const { result } = renderHook(() => useCUM())
    await act(async () => { await result.current.search("10%_vit") })
    const url = decodeURIComponent(String(fetchSpy.mock.calls[0][0]))
    expect(url).toContain("%10\\%\\_VIT%")
  })

  it('sets a friendly error on an HTTP failure', async () => {
    mockFetch(null, false, 500)
    const { result } = renderHook(() => useCUM())
    await act(async () => { await result.current.search('ace') })
    expect(result.current.error).toMatch(/Sin conexión/)
    expect(result.current.results).toEqual([])
  })

  it('aborts the in-flight request when a newer search starts', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    mockFetch([])
    const { result } = renderHook(() => useCUM())
    await act(async () => { await result.current.search('ace') })
    await act(async () => { await result.current.search('ibu') })
    expect(abortSpy).toHaveBeenCalled()
  })

  it('clear() aborts and resets all state', async () => {
    mockFetch([rec()])
    const { result } = renderHook(() => useCUM())
    await act(async () => { await result.current.search('ace') })
    expect(result.current.results.length).toBeGreaterThan(0)
    act(() => { result.current.clear() })
    expect(result.current.results).toEqual([])
    expect(result.current.searched).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
