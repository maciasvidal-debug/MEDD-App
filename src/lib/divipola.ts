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

const rec = (e: typeof INDEX[number]): MunicipioRecord =>
  ({ municipio: e.municipio, departamento: e.departamento, codigo: e.codigo })

const byName = (a: MunicipioRecord, b: MunicipioRecord) =>
  a.municipio.localeCompare(b.municipio, 'es')

// The 33 departments, alphabetical — drives the cascading "department first" select.
export const DEPARTAMENTOS: readonly string[] =
  Array.from(new Set(DIVIPOLA.map(([, d]) => d))).sort((a, b) => a.localeCompare(b, 'es'))

/**
 * Municipality search. When `departamento` is given, results are scoped to it —
 * and an empty/short term lists that department's whole municipality set
 * (alphabetical) so it can be browsed in the cascade. Without a department a
 * term under 2 chars returns nothing. Matches are accent/case-insensitive,
 * prefix matches first.
 */
export function searchMunicipios(term: string, limit = 10, departamento?: string): MunicipioRecord[] {
  const q = fold(term)
  const pool = departamento ? INDEX.filter(e => e.departamento === departamento) : INDEX
  if (q.length < 2) {
    return departamento ? pool.map(rec).sort(byName).slice(0, limit) : []
  }
  const starts: MunicipioRecord[] = []
  const contains: MunicipioRecord[] = []
  for (const e of pool) {
    const i = e.key.indexOf(q)
    if (i === 0) starts.push(rec(e))
    else if (i > 0) contains.push(rec(e))
  }
  starts.sort(byName); contains.sort(byName)
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
