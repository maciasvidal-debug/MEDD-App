// ─── Canonicalisation of the free-text "ciudad" field ──────────────────────
//
// The capture field is an autocomplete over the DANE catalogue but ultimately
// stores free text (and, offline, that's the only path), so the same
// municipality arrives spelled many ways: casing ("MALAMBO"), missing accents
// ("Atlantico"), stray spacing ("Barranquilla ,Atlántico") and an appended
// department with assorted separators ("Polonuevo-Atlantico",
// "Atlántico/Barranquilla", "Sabanalarga Atlantico").
//
// `normalizeCiudad` folds that variance into a clean { municipio, departamento }
// (for storage/display); `ciudadKey` derives a stable grouping key so the
// dashboard counts one city once instead of four near-duplicates.

// Diacritic-fold + lowercase + trim — the basis for every case-insensitive match.
export const fold = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// The 32 departments + Bogotá (folded). These are the ONLY tokens we ever strip,
// so a genuine municipality name is never mistaken for a department. Longest
// first, so multi-word departments match before their shorter prefixes
// (e.g. "valle del cauca" before "valle", "norte de santander" before "santander").
const DEPARTAMENTOS = [
  'amazonas', 'antioquia', 'arauca', 'atlantico', 'bolivar', 'boyaca', 'caldas',
  'caqueta', 'casanare', 'cauca', 'cesar', 'choco', 'cordoba', 'cundinamarca',
  'guainia', 'guaviare', 'huila', 'la guajira', 'guajira', 'magdalena', 'meta',
  'narino', 'norte de santander', 'putumayo', 'quindio', 'risaralda',
  'san andres y providencia', 'san andres', 'santander', 'sucre', 'tolima',
  'valle del cauca', 'valle', 'vaupes', 'vichada',
  'bogota d c', 'bogota dc', 'bogota',
].sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length)

const DEPT_SET = new Set(DEPARTAMENTOS)

// Spanish title-case keeping connectors lowercase (de, del, la, los…).
const MINOR = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e'])
const titleCase = (s: string) =>
  s.split(/\s+/).filter(Boolean)
    .map((w, i) => (i > 0 && MINOR.has(fold(w)))
      ? fold(w)
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

export interface Ciudad { municipio: string; departamento: string }

/**
 * Splits a raw city string into a clean municipality and (when present) the
 * department that was appended to it. Never strips a single bare token, so a
 * municipality whose name coincides with a department (e.g. "Córdoba") is kept.
 */
export function normalizeCiudad(raw: string | null | undefined): Ciudad {
  const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return { municipio: '', departamento: '' }

  let muni = cleaned
  let dept = ''

  // 1) Explicit separators: comma, slash or pipe.
  const parts = cleaned.split(/\s*[,/|]\s*/).map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const deptPart = parts.find(p => DEPT_SET.has(fold(p)))
    if (deptPart) {
      dept = deptPart
      muni = parts.filter(p => p !== deptPart).join(' ')
    } else {
      muni = parts[0]
      dept = parts.slice(1).join(' ')
    }
  }

  // 2) Dash-joined "Polonuevo-Atlantico" (only split when one side is a dept).
  if (!dept && muni.includes('-')) {
    const dparts = muni.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean)
    const deptPart = dparts.find(p => DEPT_SET.has(fold(p)))
    if (deptPart && dparts.length >= 2) {
      dept = deptPart
      muni = dparts.filter(p => p !== deptPart).join(' ')
    }
  }

  // 3) Trailing department word(s): "Sabanalarga Atlantico", "barranquilla atlantico".
  if (!dept) {
    const words = muni.split(' ')
    for (const d of DEPARTAMENTOS) {
      const dWords = d.split(' ')
      if (words.length > dWords.length) { // keep ≥1 word as the municipality
        const tail = fold(words.slice(-dWords.length).join(' '))
        if (tail === d) {
          dept = words.slice(-dWords.length).join(' ')
          muni = words.slice(0, words.length - dWords.length).join(' ')
          break
        }
      }
    }
  }

  return { municipio: titleCase(muni), departamento: dept ? titleCase(dept) : '' }
}

/** Stable grouping key (folded municipality, department stripped). '' for blanks. */
export const ciudadKey = (raw: string | null | undefined) => fold(normalizeCiudad(raw).municipio)
