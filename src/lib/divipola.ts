import { DIVIPOLA } from './divipola.data'
import { fold } from './ciudad'

// Offline search over the bundled DIVIPOLA catalogue. Replaces the previous
// network (datos.gov.co) lookup so the city autocomplete works without
// connectivity and always returns a canonical municipality + department — the
// field is offline-first, so a network-only catalogue forced free text in the
// field, which was the root of the city heterogeneity.

export interface MunicipioRecord { municipio: string; departamento: string; codigo: string }

// Fold every name once up front so each keystroke is a cheap substring scan.
const INDEX = DIVIPOLA.map(([municipio, departamento, codigo]) => ({
  municipio, departamento, codigo, key: fold(municipio),
}))

/**
 * Returns up to `limit` municipalities matching `term` (accent/case-insensitive),
 * prefix matches first, then internal matches. Empty for terms under 2 chars.
 */
export function searchMunicipios(term: string, limit = 10): MunicipioRecord[] {
  const q = fold(term)
  if (q.length < 2) return []
  const starts: MunicipioRecord[] = []
  const contains: MunicipioRecord[] = []
  for (const e of INDEX) {
    const i = e.key.indexOf(q)
    if (i === 0) starts.push(e)
    else if (i > 0) contains.push(e)
  }
  return [...starts, ...contains].slice(0, limit)
}

/**
 * Department for a municipality, but ONLY when the name resolves to a single
 * catalogue entry. Same-named municipalities (e.g. Sabanalarga in Atlántico vs
 * Casanare) are ambiguous → returns '' so the surveyor must disambiguate by
 * picking from the dropdown. Used to auto-fill `departamento` for free text.
 */
export function lookupDepartamento(municipio: string): string {
  const q = fold(municipio)
  if (!q) return ''
  const matches = INDEX.filter(e => e.key === q)
  return matches.length === 1 ? matches[0].departamento : ''
}
