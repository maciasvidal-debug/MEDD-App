// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNetworkStatus } from './useNetworkStatus'

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

beforeEach(() => setOnLine(true))
afterEach(() => {
  setOnLine(true)
  vi.restoreAllMocks()
})

describe('useNetworkStatus', () => {
  it('seeds from navigator.onLine', () => {
    setOnLine(false)
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe(false)
  })

  it('updates when offline/online events fire', () => {
    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe(true)

    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(result.current).toBe(false)

    act(() => { window.dispatchEvent(new Event('online')) })
    expect(result.current).toBe(true)
  })

  it('removes its listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useNetworkStatus())
    unmount()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
