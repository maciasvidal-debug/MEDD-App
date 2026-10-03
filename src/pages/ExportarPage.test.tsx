// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportarPage } from './ExportarPage'
import { useStore } from '../lib/store'
import * as csvLib from '../lib/csv'
import * as utilsLib from '../lib/utils'

// Mock dependencies
vi.mock('../lib/csv', () => ({
  toCSV: vi.fn(),
  toAnalyticalCSV: vi.fn(),
  toCodebookCSV: vi.fn(),
}))

vi.mock('../lib/utils', () => ({
  downloadBlob: vi.fn(),
}))

// We can spy on the store's pushToast function
const mockPushToast = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  useStore.setState({
    surveys: [{ id: 's1', version: 1 } as unknown as import('../types').Survey],
    pushToast: mockPushToast,
  })
})

describe('ExportarPage', () => {
  it('shows an error toast when exportCSV throws', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Mocked export error'

    // Simulate toCSV throwing an error (e.g., null-version record)
    vi.mocked(csvLib.toCSV).mockImplementationOnce(() => {
      throw new Error(errorMessage)
    })

    render(<ExportarPage />)

    // Click the standard CSV export button
    const csvButton = screen.getByRole('button', { name: /Descargar \.csv$/i })
    await user.click(csvButton)

    // Verify error was caught and pushToast was called with the correct message
    expect(mockPushToast).toHaveBeenCalledWith(errorMessage, 'error')
    expect(utilsLib.downloadBlob).not.toHaveBeenCalled()
  })

  it('shows a fallback error toast when exportCSV throws a non-Error object', async () => {
    const user = userEvent.setup()

    // Simulate toCSV throwing a non-Error
    vi.mocked(csvLib.toCSV).mockImplementationOnce(() => {
      throw 'String error'
    })

    render(<ExportarPage />)

    const csvButton = screen.getByRole('button', { name: /Descargar \.csv$/i })
    await user.click(csvButton)

    expect(mockPushToast).toHaveBeenCalledWith('No se pudo exportar el CSV', 'error')
    expect(utilsLib.downloadBlob).not.toHaveBeenCalled()
  })

  it('downloads CSV and shows a success toast on happy path', async () => {
    const user = userEvent.setup()

    vi.mocked(csvLib.toCSV).mockReturnValue('col1,col2\nval1,val2')

    render(<ExportarPage />)

    const csvButton = screen.getByRole('button', { name: /Descargar \.csv$/i })
    await user.click(csvButton)

    // downloadBlob should have been called
    expect(utilsLib.downloadBlob).toHaveBeenCalledWith(
      'col1,col2\nval1,val2',
      expect.stringMatching(/^MEDD_.*\.csv$/),
      'text/csv;charset=utf-8'
    )

    // success toast should have been pushed
    expect(mockPushToast).toHaveBeenCalledWith(expect.stringContaining('CSV exportado'), 'success')
  })
})
