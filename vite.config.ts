import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor code out of the main entry so the
        // initial bundle parses faster and these chunks cache across deploys.
        // (Recharts already lives in its own lazy Dashboard chunk.)
        manualChunks(id: string) {
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react'
          if (id.includes('@supabase')) return 'supabase'
        },
      },
    },
  },
})
