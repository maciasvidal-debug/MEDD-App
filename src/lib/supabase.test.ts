import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('supabase initialization', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('provides a fallback client and logs a warning when VITE_SUPABASE_URL is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'some-key')

    // Simulate import.meta.env.DEV being true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubEnv('DEV', true as any)

    const { supabase } = await import('./supabase')

    expect(consoleSpy).toHaveBeenCalledWith('Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
    expect(supabase).toBeDefined()

    // @ts-expect-error Accessing protected property for testing
    expect(supabase.supabaseUrl).toBe('https://placeholder.supabase.co')

    consoleSpy.mockRestore()
  })

  it('provides a fallback client and logs a warning when VITE_SUPABASE_ANON_KEY is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubEnv('DEV', true as any)

    const { supabase } = await import('./supabase')

    expect(consoleSpy).toHaveBeenCalledWith('Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
    expect(supabase).toBeDefined()
    // @ts-expect-error Accessing protected property for testing
    expect(supabase.supabaseKey).toBe('placeholder-key')

    consoleSpy.mockRestore()
  })

  it('successfully creates the client with correct credentials when variables are present', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'valid-key')

    const { supabase } = await import('./supabase')

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(supabase).toBeDefined()
    // @ts-expect-error Accessing protected property for testing
    expect(supabase.supabaseUrl).toBe('https://example.supabase.co')
    // @ts-expect-error Accessing protected property for testing
    expect(supabase.supabaseKey).toBe('valid-key')

    consoleSpy.mockRestore()
  })
})
