import { createPublicClient, getAddress, http, isAddress } from 'viem'
import { arbitrum } from 'viem/chains'

export const CHAIN_ID = arbitrum.id
export const CRVUSD_ADDRESS = getAddress(
  '0x498Bf2B1e120FeD3ad3D42EA2165E9b73f99C1e5',
)
export const MAX_REDEEM_STEPS = 32n

export const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(
    import.meta.env.VITE_ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    {
      timeout: 8_000,
      retryCount: 1,
    },
  ),
})

export function configuredEngine() {
  const value = import.meta.env.VITE_VAULT_ENGINE_ADDRESS?.trim()
  if (!value) return { status: 'missing' as const }
  if (!isAddress(value)) return { status: 'invalid' as const }
  return { status: 'configured' as const, address: getAddress(value) }
}
