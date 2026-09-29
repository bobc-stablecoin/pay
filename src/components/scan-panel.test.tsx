// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ScanPanel } from './scan-panel'

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoDevice() {
      return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
    }
  },
}))

it('offers paste fallback when camera access is denied', async () => {
  const onResult = vi.fn()
  render(<ScanPanel onResult={onResult} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open camera' }))

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toMatch(/Paste the payment code/),
  )
  expect(screen.getByRole('button', { name: 'Open camera' })).toBeTruthy()
  expect(onResult).not.toHaveBeenCalled()
})
