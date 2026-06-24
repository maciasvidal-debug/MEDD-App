import { useState, useCallback } from 'react'
import { searchMunicipios } from '../lib/divipola'

export interface MunicipioRecord {
  municipio:    string
  departamento: string
}

// Offline-first municipio lookup backed by the bundled DIVIPOLA catalogue
// (src/lib/divipola.data.ts). Previously this hit a remote SoQL endpoint, which
// failed in the field (no connectivity) and forced surveyors into free text —
// the source of the city heterogeneity. Now it resolves synchronously against
// the local catalogue, so there is no loading or network-error state.
export function useMunicipios() {
  const [results, setResults] = useState<MunicipioRecord[]>([])

  // When a department is given, results are scoped to it and an empty term lists
  // the whole department (browsable); a higher cap lets the larger departments
  // (Antioquia, Cundinamarca…) show in full.
  const search = useCallback((term: string, departamento?: string) => {
    setResults(searchMunicipios(term, departamento ? 200 : 10, departamento))
  }, [])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading: false, error: '', search, clear }
}
