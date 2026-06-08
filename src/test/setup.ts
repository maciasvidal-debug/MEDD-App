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
