// ─── RBQM R2 — Fidelidad de la medición ─────────────────────────────────────
// El piloto reveló sesgo de información por medición heterogénea: ICC entre
// encuestadores 0,27 y la DURACIÓN de la entrevista predijo el reporte del
// desenlace (a más tiempo, más hallazgo). Las entrevistas apresuradas
// subregistran. Este módulo modela la duración ESPERADA de una entrevista para
// poder marcar las implausiblemente rápidas como señal de calidad.
//
// Ancla del modelo (criterio del stakeholder, 2026-07-25): la mediana de duración
// para una entrevista con un inventario de 1 ítem es ≈ 474 s.
//
// Coste marginal por ítem (≈ 39 s): estimado por regresión robusta (Theil-Sen)
// sobre el CSV real del piloto (n=100 entrevistas con para-data de duración,
// excluidos los outliers > 1 h atribuibles a la «app dejada abierta»). Se prefirió
// Theil-Sen a mínimos cuadrados por la fuerte asimetría de la duración.
//
// El sobrecoste FIJO de la entrevista domina (en el piloto, las entrevistas con 0 y
// con 1 ítem tienen mediana casi igual), así que el modelo es lineal con un intercepto
// alto y una pendiente modesta por ítem.

/** Mediana de duración (s) de referencia para un inventario de 1 ítem. */
export const EXPECTED_MEDIAN_1ITEM_S = 474

/** Segundos marginales esperados por cada ítem de inventario adicional. */
export const MARGINAL_S_PER_ITEM = 39

/**
 * Fracción de la duración esperada por debajo de la cual una entrevista se marca
 * como «apresurada». 0,5 = mitad de la mediana esperada: regla conservadora y
 * estándar para detectar «speeders» en metodología de encuestas. Es un CRITERIO
 * configurable (no derivado del dato); documentado como constante, no oculto.
 */
export const RUSHED_FRACTION = 0.5

/**
 * Duración esperada (s) de una entrevista con `nItems` medicamentos en inventario.
 * E(ítems) = 474 + 39·(ítems − 1). Para 0 ítems da 435 s (intercepto − pendiente),
 * coherente con la mediana observada del subgrupo sin inventario.
 */
export function expectedDurationS(nItems: number): number {
  const items = Math.max(0, Math.floor(nItems || 0))
  return EXPECTED_MEDIAN_1ITEM_S + MARGINAL_S_PER_ITEM * (items - 1)
}

/** Umbral (s) por debajo del cual una entrevista es «apresurada» para ese inventario. */
export function rushedThresholdS(nItems: number): number {
  return Math.round(RUSHED_FRACTION * expectedDurationS(nItems))
}

/**
 * ¿La entrevista fue implausiblemente rápida para su tamaño de inventario?
 * Devuelve false cuando no hay duración medible (0, negativa, nula o no finita):
 * la ausencia de para-data NO es una señal de apresuramiento, es dato faltante.
 */
export function isRushed(durationS: number | null | undefined, nItems: number): boolean {
  if (durationS == null || !Number.isFinite(durationS) || durationS <= 0) return false
  return durationS < rushedThresholdS(nItems)
}
