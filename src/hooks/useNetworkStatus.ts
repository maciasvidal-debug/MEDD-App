import { useState, useEffect } from 'react'

// Tracks browser connectivity via the online/offline window events. Seeds from
// navigator.onLine (guarded for SSR/non-browser) and keeps the value in sync.
// Extracted from App.tsx, where the same listener wiring was duplicated across
// the offline and pending-sync banners.
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
