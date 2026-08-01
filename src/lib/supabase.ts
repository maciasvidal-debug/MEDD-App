import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
}

// Fallback logic for Node.js environments (like Vitest in CI on older Node versions)
// that lack native globalThis.WebSocket support required by Supabase Realtime.
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null

let options = {}
if (isNode && typeof globalThis.WebSocket === 'undefined') {
  options = {
    realtime: {
      transport: ws
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, options)
