import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('supabase client initialization', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('throws an error when VITE_SUPABASE_URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'some-key')

    await expect(import('./supabase')).rejects.toThrow('Missing Supabase environment variables')
  })

  it('throws an error when VITE_SUPABASE_ANON_KEY is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    await expect(import('./supabase')).rejects.toThrow('Missing Supabase environment variables')
  })

  it('successfully creates the client when variables are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'some-valid-key')

    const module = await import('./supabase')
    expect(module.supabase).toBeDefined()
    expect(module.supabase.auth).toBeDefined()
  })
})
