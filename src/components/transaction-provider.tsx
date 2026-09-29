import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { type Address, type Hex } from 'viem'
import { CHAIN_ID, publicClient } from '../lib/chain'

export type PendingTransaction = {
  hash: Hex
  account: Address
  label: string
  submittedAt: number
  status: 'confirming' | 'confirmed' | 'reverted'
}
type TransactionContextValue = {
  transactions: PendingTransaction[]
  add: (transaction: Omit<PendingTransaction, 'status' | 'submittedAt'>) => void
  dismiss: (hash: Hex) => void
}
const TransactionContext = createContext<TransactionContextValue | null>(null)
const storageKey = 'bobc-pay-transactions-v1'

function readStored(): PendingTransaction[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is PendingTransaction =>
          typeof item === 'object' &&
          item !== null &&
          /^0x[a-fA-F0-9]{64}$/.test(item.hash) &&
          /^0x[a-fA-F0-9]{40}$/.test(item.account) &&
          typeof item.label === 'string' &&
          typeof item.submittedAt === 'number' &&
          ['confirming', 'confirmed', 'reverted'].includes(item.status),
      )
      .slice(0, 8)
  } catch {
    return []
  }
}

export function TransactionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [transactions, setTransactions] = useState<PendingTransaction[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setTransactions(readStored())
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(transactions))
    } catch {
      /* Storage can be unavailable in a private browser context. */
    }
  }, [loaded, transactions])
  useEffect(() => {
    if (!loaded || !transactions.some((tx) => tx.status === 'confirming'))
      return
    let active = true
    const check = async () => {
      const pending = transactions.filter((tx) => tx.status === 'confirming')
      await Promise.all(
        pending.map(async (tx) => {
          try {
            const receipt = await publicClient.getTransactionReceipt({
              hash: tx.hash,
            })
            if (!active) return
            const status: PendingTransaction['status'] =
              receipt.status === 'success' ? 'confirmed' : 'reverted'
            setTransactions((current) =>
              current.map((item) =>
                item.hash === tx.hash ? { ...item, status } : item,
              ),
            )
            void queryClient.invalidateQueries({
              queryKey: ['balance', CHAIN_ID, tx.account],
            })
            void queryClient.invalidateQueries({
              queryKey: ['oracle', CHAIN_ID],
            })
          } catch {
            /* The receipt may not exist yet or the RPC may be temporarily unavailable. */
          }
        }),
      )
    }
    void check()
    const timer = window.setInterval(() => {
      void check()
    }, 8_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [loaded, transactions, queryClient])

  const add: TransactionContextValue['add'] = (transaction) => {
    const next: PendingTransaction = {
      ...transaction,
      status: 'confirming',
      submittedAt: Date.now(),
    }
    setTransactions((current) =>
      [next, ...current.filter((item) => item.hash !== transaction.hash)].slice(
        0,
        8,
      ),
    )
  }
  const dismiss = (hash: Hex) =>
    setTransactions((current) => current.filter((item) => item.hash !== hash))
  return (
    <TransactionContext.Provider value={{ transactions, add, dismiss }}>
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransactions() {
  const context = useContext(TransactionContext)
  if (!context) throw new Error('TransactionProvider is missing')
  return context
}
