// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMunicipios } from './useMunicipios'

// The municipio combobox debounces (300ms) and hits a remote SoQL endpoint.
// These exercise the timing/escaping/error edges that are hard to verify by hand.
describe('useMunicipios', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

  it('does not fetch for terms shorter than 2 chars and clears state', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('a') })
    act(() => { vi.advanceTimersByTime(500) })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
    expect(result.current.error).toBe('')
  })

  it('debounces rapid calls into a single fetch after 300ms', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => [{ municipio: 'BOGOTA', departamento: 'CUNDINAMARCA' }],
    } as Response)
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('bog') })
    act(() => { result.current.search('bogo') })
    act(() => { result.current.search('bogot') })
    expect(fetchSpy).not.toHaveBeenCalled() // nothing until the timer fires
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.current.results).toHaveLength(1)
    expect(result.current.loading).toBe(false)
  })

  it('uppercases the term and escapes single quotes in the LIKE clause', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => [],
    } as Response)
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search("be'l") })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    const url = decodeURIComponent(String(fetchSpy.mock.calls[0][0])).replace(/\+/g, ' ')
    expect(url).toContain("upper(municipio) LIKE '%BE''L%'")
  })

  it('surfaces a friendly error on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('bogota') })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(result.current.error).toMatch(/Sin conexión/)
    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('clear() cancels a pending debounce so no request fires', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => [] } as Response)
    const { result } = renderHook(() => useMunicipios())
    act(() => { result.current.search('bogota') })
    act(() => { result.current.clear() })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
    expect(result.current.error).toBe('')
  })
})
