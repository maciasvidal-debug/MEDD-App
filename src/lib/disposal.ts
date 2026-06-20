// =====================================================================
// Disposición de medicamentos — normalización del texto libre heredado.
//
// El instrumento v1 capturaba la práctica de disposición como TEXTO LIBRE en
// `ctoDispVc` ("¿qué hace con los vencidos?"). El v2 lo estructuró en
// `dispFinal[]` (selección múltiple). Para analizar v1+v2 de forma unificada,
// este módulo mapea el texto libre a las MISMAS categorías de OPT.dispFinal por
// palabras clave normalizadas.
//
// Es PURO y determinista: no muta datos (los registros v1 se conservan tal
// cual); la categoría se DERIVA en tiempo de análisis, como respaldo cuando no
// hay valor estructurado. Idempotente y trivial de testear. El texto que no
// coincide con ninguna categoría devuelve [] (se reporta como cobertura).
// =====================================================================

import { OPT } from './constants'

// Etiquetas canónicas (deben coincidir exactamente con OPT.dispFinal).
const CAT = {
  basura:   'Basura',
  inodoro:  'Inodoro / desagüe',
  farmacia: 'Devuelve a farmacia / punto azul',
  regala:   'Regala',
  guarda:   'Los guarda',
  otro:     'Otro',
} as const

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Deriva las categorías de disposición (subconjunto de OPT.dispFinal) a partir
 *  del texto libre heredado `ctoDispVc`. Devuelve [] si no reconoce nada. */
export function disposalCategories(text: string): string[] {
  const t = normalize(text || '')
  if (!t) return []
  const out = new Set<string>()
  const has = (...keys: string[]) => keys.some(k => t.includes(k))

  if (has('basura', 'caneca')) out.add(CAT.basura)
  if (has('inodoro', 'sanitario', 'bano', 'desague', 'alcantar', 'lavamanos', 'wc')) out.add(CAT.inodoro)
  if (has('farmacia', 'droguer', 'punto azul', 'puntos azul', 'devuel', 'devolu', 'eps', 'ips', 'hospital', 'centro de salud')) out.add(CAT.farmacia)
  if (has('regal', 'dona', 'dono', 'presta', 'comparte', 'reutiliz')) out.add(CAT.regala)
  if (has('guard', 'almacen', 'conserv')) out.add(CAT.guarda)
  if (has('quem', 'entierr', 'enterr', 'recicl')) out.add(CAT.otro)

  // Devolver en el orden canónico de OPT.dispFinal.
  return OPT.dispFinal.filter(c => out.has(c))
}
