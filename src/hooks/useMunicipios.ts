import { useState, useRef, useCallback } from 'react'

export interface MunicipioRecord {
  municipio:    string
  departamento: string
}

const API = 'https://www.datos.gov.co/resource/82di-kkh9.json'

export function useMunicipios() {
  const [results, setResults] = useState<MunicipioRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((term: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (term.trim().length < 2) { setResults([]); setError(''); return }

    timer.current = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const t = term.trim().toUpperCase().replace(/'/g, "''")
        const url = new URL(API)
        url.searchParams.set('$limit', '10')
        url.searchParams.set('$order', 'municipio ASC')
        url.searchParams.set('$where', `upper(municipio) LIKE '%${t}%'`)
        const res = await fetch(url.toString())
        if (!res.ok) throw new Error()
        const data = await res.json()
        setResults(data as MunicipioRecord[])
      } catch {
        setError('Sin conexión al catálogo de municipios')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setResults([])
    setError('')
    setLoading(false)
  }, [])

  return { results, loading, error, search, clear }
}
