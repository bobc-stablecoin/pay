import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { arbitrum } from 'viem/chains'
import { TransactionProvider } from './transaction-provider'

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 12_000, refetchOnWindowFocus: true },
        },
      }),
  )
  const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim()

  if (!appId || appId.length !== 25) {
    return (
      <main className="state wrap" id="main">
        <p className="eyebrow">Setup needed</p>
        <h1 className="display">
          BOBC <em>Pay</em>
        </h1>
        <p className="lede">
          Set VITE_PRIVY_APP_ID to a valid Privy app ID to enable sign in.
        </p>
      </main>
    )
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'wallet'],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        supportedChains: [arbitrum],
        defaultChain: arbitrum,
        appearance: {
          theme: 'dark',
          accentColor: '#3fcb86',
          logo: '/bobc.svg',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TransactionProvider>{children}</TransactionProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
