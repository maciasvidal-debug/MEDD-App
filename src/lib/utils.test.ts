import { describe, it, expect, vi, afterEach } from 'vitest'
import { pct, compareSortable, uuid } from './utils'

describe('pct', () => {
  it('rounds the percentage', () => {
    expect(pct(1, 3)).toBe(33)
    expect(pct(1, 2)).toBe(50)
  })
  it('returns 0 for a zero/empty base (no division by zero)', () => {
    expect(pct(5, 0)).toBe(0)
    expect(pct(0, 0)).toBe(0)
  })
})

describe('compareSortable', () => {
  it('orders numbers numerically', () => {
    expect(compareSortable(2, 10)).toBeLessThan(0)
    expect(compareSortable(10, 2)).toBeGreaterThan(0)
  })
  it('orders strings with numeric-aware locale collation', () => {
    expect(compareSortable('Bogotá', 'Cali')).toBeLessThan(0)
    expect(compareSortable('item2', 'item10')).toBeLessThan(0)
  })
  it('always sorts empty values last regardless of the other operand', () => {
    expect(compareSortable(null, 5)).toBeGreaterThan(0)
    expect(compareSortable('', 'a')).toBeGreaterThan(0)
    expect(compareSortable(5, undefined)).toBeLessThan(0)
    expect(compareSortable(null, null)).toBe(0)
  })
})

describe('uuid', () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('produces a v4-shaped, unique identifier', () => {
    const a = uuid()
    const b = uuid()
    expect(a).toMatch(V4)
    expect(a).not.toBe(b)
  })

  it('falls back to a getRandomValues-filled template when randomUUID is absent', () => {
    // Simulate an insecure (http) context: crypto exists with getRandomValues
    // but no randomUUID. The result must still be a well-formed v4 UUID.
    const realCrypto = globalThis.crypto
    vi.stubGlobal('crypto', {
      getRandomValues: realCrypto.getRandomValues.bind(realCrypto),
    })
    const id = uuid()
    expect(id).toMatch(V4)
  })

  it('fails fast instead of using an insecure source when Web Crypto is unavailable', () => {
    // No crypto at all: rather than silently degrade to Math.random(), uuid must
    // throw so a weak/predictable identifier is never produced.
    vi.stubGlobal('crypto', undefined)
    const randomSpy = vi.spyOn(Math, 'random')
    expect(() => uuid()).toThrow(/Web Crypto API is required/)
    expect(randomSpy).not.toHaveBeenCalled()
  })
})
