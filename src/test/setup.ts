// Shared Vitest setup. Runs for every test file (node and jsdom alike).
//
// - Registers @testing-library/jest-dom matchers (e.g. toBeInTheDocument).
// - Unmounts React trees after each test so jsdom-based tests stay isolated.
//
// Both imports are inert for the node-environment lib suites: the jest-dom
// matchers simply extend `expect`, and `cleanup()` is a no-op when nothing has
// been rendered.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// jsdom lacks ResizeObserver, which Recharts' ResponsiveContainer needs. Provide
// a no-op so dashboard/chart components render in tests. Harmless in node.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// Mock Vite environment variables globally for tests to prevent initialization
// failures in modules (like supabase.ts) that strictly validate their presence.
// These dummy values satisfy the checks but will be overridden by specific tests.
if (typeof import.meta.env === 'undefined') {
  Object.defineProperty(import.meta, 'env', {
    value: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key'
    },
    writable: true,
  });
} else {
  if (!import.meta.env.VITE_SUPABASE_URL) {
     import.meta.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  }
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
     import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
  }
}
