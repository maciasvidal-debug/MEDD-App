import { defineConfig } from 'vitest/config'

// Frontend unit tests only. The backend has its own Jest suite under
// backend/test, run by the backend CI — keep Vitest scoped to src/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Gate the business logic (lib/), not presentational UI. supabase.ts is a
      // thin client and constants.ts is data — neither has unit-testable logic.
      include: ['src/lib/**'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/supabase.ts', 'src/lib/constants.ts'],
      reporter: ['text-summary'],
      // Ratchet floor: set just below current measured coverage so a drop fails
      // CI, without forcing new tests today. Raise these as coverage grows.
      thresholds: { lines: 60, statements: 60, branches: 60, functions: 55 },
    },
  },
})
