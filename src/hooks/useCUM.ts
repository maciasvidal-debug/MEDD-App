import { useState, useCallback, useRef } from 'react'
import type { CUMRecord } from '../types'
import { CUM_API, CUM_FIELDS } from '../lib/constants'

interface UseCUMResult {
  results: CUMRecord[]
  loading: boolean
  error: string | null
  searched: boolean
  search: (term: string) => Promise<void>
  clear: () => void
}

/** Deduplicates CUM records by producto+principioactivo+concentracion */
function dedupe(records: CUMRecord[]): CUMRecord[] {
  const seen = new Set<string>()
  return records.filter(r => {
    const key = `${r.producto}|${r.principioactivo}|${r.concentracion}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function useCUM(): UseCUMResult {
  const [results, setResults] = useState<CUMRecord[]>([])
  const [loading, setLoading]  = useState(false)
  const [error, setError]      = useState<string | null>(null)
  const [searched, setSearched]= useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(async (term: string) => {
    const trimmed = term.trim()
    if (trimmed.length < 3) return

    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setSearched(false)
    setResults([])

    try {
      // Escape single quotes (SoQL string-literal escaping) before interpolating
      // the user term into the $where clause — mirrors useMunicipios and prevents
      // query breakage / SoQL injection from terms containing apostrophes.
      const safe = trimmed.toUpperCase().replace(/'/g, "''")
      const where = encodeURIComponent(
        `(upper(producto) like '%${safe}%' OR ` +
        `upper(principioactivo) like '%${safe}%') AND ` +
        `estadoregistro='Vigente'`
      )
      const url =
        `${CUM_API}` +
        `?$select=${CUM_FIELDS}` +
        `&$where=${where}` +
        `&$limit=20` +
        `&$order=producto ASC`

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: CUMRecord[] = await res.json()
      setResults(dedupe(data))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      console.error('[CUM API]', err)
      setError('Sin conexión a datos.gov.co. Verifique su acceso a internet.')
      setResults([])
    } finally {
      // Only settle UI state if this request is still the current one; a request
      // superseded by a newer search must not clobber the in-flight request's state.
      if (abortRef.current === controller) {
        setLoading(false)
        setSearched(true)
      }
    }
  }, [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setResults([])
    setError(null)
    setSearched(false)
    setLoading(false)
  }, [])

  return { results, loading, error, searched, search, clear }
}
