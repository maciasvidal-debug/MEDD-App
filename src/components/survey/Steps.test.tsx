// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Step1 } from './Steps'
import { EMPTY_DRAFT } from '../../lib/constants'
import type { SurveyDraft } from '../../types'

// Steps.tsx transitively imports the store, which constructs the Supabase client
// at module load; stub it so the import doesn't require env vars.
vi.mock('../../lib/supabase', () => ({ supabase: {} }))

const draft = (over: Partial<SurveyDraft> = {}): SurveyDraft => ({ ...EMPTY_DRAFT, ...over })

describe('Step1 — Identificación (RHF + zod integration)', () => {
  it('renders the identification fields', () => {
    render(<Step1 draft={draft({ nui: 5 })} onNext={vi.fn()} onBack={vi.fn()} isFirst />)
    expect(screen.getByText('Datos de identificación')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ej: 1012345678')).toBeInTheDocument()
  })

  it('blocks submit and shows a validation error when required fields are empty', async () => {
    const onNext = vi.fn()
    render(<Step1 draft={draft({ fEta: '', nui: 1 })} onNext={onNext} onBack={vi.fn()} isFirst />)
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(screen.getByText(/obligatoria/i)).toBeInTheDocument())
    expect(onNext).not.toHaveBeenCalled()
  })

  it('submits parsed values (nuiEtr as a number) when valid', async () => {
    const onNext = vi.fn()
    const { container } = render(
      // hogarId is prefilled (the wizard autogenerates it) and required; the
      // sampling method is NOT captured here (investigator-level, pre-study).
      <Step1 draft={draft({ fEta: '', nui: 7, hogarId: 'H-TEST01' })} onNext={onNext} onBack={vi.fn()} isFirst />,
    )
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-01-10' } })
    fireEvent.change(screen.getByPlaceholderText('Ej: 1012345678'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }))
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({
      fEta: '2026-01-10', nuiEtr: 123, nui: 7, hogarId: 'H-TEST01',
    }))
    // El método muestral no se captura en el asistente.
    expect(container.querySelector('select')).toBeNull()
  })
})
