import { describe, it, expect } from 'vitest'
import {
  EXPECTED_MEDIAN_1ITEM_S,
  MARGINAL_S_PER_ITEM,
  expectedDurationS,
  rushedThresholdS,
  isRushed,
} from './interview-timing'

describe('interview-timing (RBQM R2)', () => {
  it('ancla el modelo en la mediana del stakeholder: 474 s para 1 ítem', () => {
    expect(expectedDurationS(1)).toBe(EXPECTED_MEDIAN_1ITEM_S)
    expect(expectedDurationS(1)).toBe(474)
  })

  it('aplica el coste marginal por ítem (Theil-Sen ≈ 39 s)', () => {
    expect(expectedDurationS(2)).toBe(474 + MARGINAL_S_PER_ITEM)
    expect(expectedDurationS(3)).toBe(474 + 2 * MARGINAL_S_PER_ITEM)
    // 0 ítems = intercepto − pendiente (coherente con el subgrupo sin inventario).
    expect(expectedDurationS(0)).toBe(474 - MARGINAL_S_PER_ITEM)
  })

  it('trata entradas no válidas de nItems como 0', () => {
    expect(expectedDurationS(-5)).toBe(expectedDurationS(0))
    expect(expectedDurationS(NaN)).toBe(expectedDurationS(0))
    expect(expectedDurationS(2.9)).toBe(expectedDurationS(2))
  })

  it('el piso de apresuramiento es el 50 % de la esperada', () => {
    expect(rushedThresholdS(1)).toBe(237) // round(0.5 * 474)
    expect(rushedThresholdS(3)).toBe(Math.round(0.5 * 552))
  })

  it('marca entrevistas por debajo del piso y no las que lo cumplen', () => {
    expect(isRushed(200, 1)).toBe(true)   // < 237
    expect(isRushed(237, 1)).toBe(false)  // = piso, no apresurada
    expect(isRushed(400, 1)).toBe(false)
  })

  it('la ausencia de para-data no es señal de apresuramiento', () => {
    expect(isRushed(null, 1)).toBe(false)
    expect(isRushed(undefined, 1)).toBe(false)
    expect(isRushed(0, 1)).toBe(false)
    expect(isRushed(-10, 1)).toBe(false)
    expect(isRushed(Infinity, 1)).toBe(false)
  })

  it('escala el umbral con el inventario (más ítems ⇒ se tolera más tiempo mínimo)', () => {
    // Una entrevista de 300 s es apresurada con 5 ítems pero no con 1.
    expect(isRushed(300, 1)).toBe(false)
    expect(isRushed(300, 5)).toBe(true)
  })
})
