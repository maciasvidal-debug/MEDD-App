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

  const search = useCallback((term: string) => {
    setResults(searchMunicipios(term, 10))
  }, [])

  const clear = useCallback(() => setResults([]), [])

  return { results, loading: false, error: '', search, clear }
}
