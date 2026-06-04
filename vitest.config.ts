import { defineConfig } from 'vitest/config'

// Frontend unit tests only. The backend has its own Jest suite under
// backend/test, run by the backend CI — keep Vitest scoped to src/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
