// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionProvider, useTransactions } from './transaction-provider'

const { getReceipt } = vi.hoisted(() => ({ getReceipt: vi.fn() }))
vi.mock('../lib/chain', () => ({
  CHAIN_ID: 42161,
  publicClient: { getTransactionReceipt: getReceipt },
}))

const hash = `0x${'a'.repeat(64)}` as const
const account = `0x${'b'.repeat(40)}` as const
const storageKey = 'bobc-pay-transactions-v1'

function Status() {
  const { transactions } = useTransactions()
  return <output>{transactions[0]?.status ?? 'none'}</output>
}

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TransactionProvider>
        <Status />
      </TransactionProvider>
    </QueryClientProvider>,
  )
}

describe('pending transaction recovery', () => {
  beforeEach(() => {
    localStorage.clear()
    getReceipt.mockReset()
    localStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          hash,
          account,
          label: 'BOBC payment',
          submittedAt: Date.now(),
          status: 'confirming',
        },
      ]),
    )
  })

  it('resumes receipt tracking after a reload and records confirmation', async () => {
    getReceipt.mockResolvedValue({ status: 'success' })
    const first = mount()
    await screen.findByText('confirmed')
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem(storageKey) ?? '[]')[0].status,
      ).toBe('confirmed'),
    )
    first.unmount()
    mount()
    await screen.findByText('confirmed')
  })

  it('records a reverted receipt without marking success', async () => {
    getReceipt.mockResolvedValue({ status: 'reverted' })
    mount()
    await screen.findByText('reverted')
  })
})
