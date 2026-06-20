import { describe, it, expect } from 'vitest'
import { disposalCategories } from './disposal'
import { OPT } from './constants'

describe('disposalCategories', () => {
  it('maps the common free-text practices to canonical categories', () => {
    expect(disposalCategories('Lo boto a la basura')).toEqual(['Basura'])
    expect(disposalCategories('lo echo al inodoro')).toEqual(['Inodoro / desagüe'])
    expect(disposalCategories('lo devuelvo a la farmacia')).toEqual(['Devuelve a farmacia / punto azul'])
    expect(disposalCategories('lo guardo en casa')).toEqual(['Los guarda'])
    expect(disposalCategories('se lo regalo a un vecino')).toEqual(['Regala'])
    expect(disposalCategories('lo quemo')).toEqual(['Otro'])
  })

  it('is accent-insensitive (desagüe → desague)', () => {
    expect(disposalCategories('lo boto al desagüe')).toEqual(['Inodoro / desagüe'])
  })

  it('returns multiple categories in canonical order', () => {
    expect(disposalCategories('a la basura, y a veces al sanitario'))
      .toEqual(['Basura', 'Inodoro / desagüe'])
  })

  it('returns [] for empty or unrecognised text', () => {
    expect(disposalCategories('')).toEqual([])
    expect(disposalCategories('no sé')).toEqual([])
  })

  it('only ever returns values that exist in OPT.dispFinal', () => {
    const result = disposalCategories('basura inodoro farmacia regala guarda quema')
    expect(result.every(c => (OPT.dispFinal as readonly string[]).includes(c))).toBe(true)
  })
})
