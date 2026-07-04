// Generic, cross-cutting helpers with no domain of their own. Date logic lives
// in ./date, statistics in ./stats, and CSV export in ./csv.

// ─── UUID ─────────────────────────────────────────────────────────────────

// Cryptographically-secure UUID v4. Uses crypto.randomUUID where available
// (secure contexts), falling back to a crypto.getRandomValues-filled template
// for insecure-context (http) deployments where randomUUID may be unavailable.
// Never falls back to Math.random(): a non-CSPRNG would yield weak, potentially
// predictable record ids and worse collision resistance for a primary key, so we
// fail fast instead. Any runtime that can run this PWA (it requires IndexedDB)
// provides Web Crypto, making the throw unreachable in supported environments.
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const array = new Uint8Array(1)
      crypto.getRandomValues(array)
      const r = array[0] % 16 // 256 % 16 === 0 → uniform, no modulo bias
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }
  throw new Error('uuid(): the Web Crypto API is required to generate secure identifiers')
}

// ─── Numbers ──────────────────────────────────────────────────────────────

export const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0

/**
 * Comparator for sortable table cells. Empty values (null/undefined/'') always
 * sort last regardless of direction; numbers compare numerically and strings use
 * a locale-aware, numeric-aware collation (so "10" sorts after "2").
 */
export function compareSortable(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'es', { numeric: true })
}

// ─── Download ─────────────────────────────────────────────────────────────

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
