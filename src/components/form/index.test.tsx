// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { ChipField, YesNoField } from './index'

// Tiny harnesses that wire each adapter to a real react-hook-form instance and
// surface the current value so we can assert the binding both ways.
function ChipHarness({ onAfterChange }: { onAfterChange?: (v: string) => void }) {
  const { control, watch } = useForm({ defaultValues: { etnia: '' } })
  return (
    <>
      <ChipField
        control={control} name="etnia" label="Pertenencia étnica"
        options={['Ninguna', 'Indígena']} onAfterChange={onAfterChange}
      />
      <output data-testid="val">{watch('etnia')}</output>
    </>
  )
}

function YesNoHarness() {
  const { control, watch } = useForm({ defaultValues: { medSob: '' } })
  return (
    <>
      <YesNoField control={control} name="medSob" label="¿Tiene medicamentos?" />
      <output data-testid="val">{watch('medSob')}</output>
    </>
  )
}

describe('ChipField', () => {
  it('renders the label and every option', () => {
    render(<ChipHarness />)
    expect(screen.getByText('Pertenencia étnica')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ninguna' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Indígena' })).toBeInTheDocument()
  })

  it('selects an option, then toggles it back off', async () => {
    const user = userEvent.setup()
    render(<ChipHarness />)
    expect(screen.getByTestId('val')).toHaveTextContent('')
    await user.click(screen.getByRole('radio', { name: 'Indígena' }))
    expect(screen.getByTestId('val')).toHaveTextContent('Indígena')
    await user.click(screen.getByRole('radio', { name: 'Indígena' }))
    expect(screen.getByTestId('val')).toHaveTextContent('')
  })

  it('runs onAfterChange with the new value (dependent-field hook)', async () => {
    const user = userEvent.setup()
    const onAfterChange = vi.fn()
    render(<ChipHarness onAfterChange={onAfterChange} />)
    await user.click(screen.getByRole('radio', { name: 'Ninguna' }))
    expect(onAfterChange).toHaveBeenCalledWith('Ninguna')
  })
})

describe('YesNoField', () => {
  it('renders the label and binds the chosen answer', async () => {
    const user = userEvent.setup()
    render(<YesNoHarness />)
    expect(screen.getByText('¿Tiene medicamentos?')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Sí' }))
    expect(screen.getByTestId('val')).toHaveTextContent('Sí')
  })
})
