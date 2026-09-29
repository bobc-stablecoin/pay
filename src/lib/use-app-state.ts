import { usePrivy, useActiveWallet, useWallets } from '@privy-io/react-auth'
import { useQuery } from '@tanstack/react-query'
import { getAddress, isAddress } from 'viem'
import { CHAIN_ID, configuredEngine, publicClient } from './chain'
import { readBalance, readOracle, verifyDeployment } from './protocol'
import { isSponsoredEmailWallet } from './wallet-policy'

const engineConfig = configuredEngine()

export function useAppState() {
  const privy = usePrivy()
  const { wallet: activeWallet } = useActiveWallet()
  const { wallets, ready: walletsReady } = useWallets()
  const wallet = activeWallet?.type === 'ethereum' ? activeWallet : wallets[0]
  const account =
    privy.authenticated && wallet && isAddress(wallet.address)
      ? getAddress(wallet.address)
      : undefined
  const emailWallet = isSponsoredEmailWallet(
    Boolean(privy.user?.email),
    wallet?.walletClientType,
  )

  const deployment = useQuery({
    queryKey: [
      'deployment',
      CHAIN_ID,
      engineConfig.status === 'configured' ? engineConfig.address : '',
    ],
    queryFn: () => {
      if (engineConfig.status !== 'configured')
        throw new Error('VaultEngine address is missing.')
      return verifyDeployment(engineConfig.address)
    },
    enabled: engineConfig.status === 'configured',
    staleTime: 60_000,
  })
  const balance = useQuery({
    queryKey: ['balance', CHAIN_ID, account, deployment.data?.bobc],
    queryFn: () => readBalance(deployment.data!.bobc, account!),
    enabled: Boolean(account && deployment.data),
    refetchInterval: 20_000,
  })
  const ethBalance = useQuery({
    queryKey: ['eth-balance', CHAIN_ID, account],
    queryFn: () => publicClient.getBalance({ address: account! }),
    enabled: Boolean(account && !emailWallet),
    refetchInterval: 20_000,
  })
  const oracle = useQuery({
    queryKey: ['oracle', CHAIN_ID, deployment.data?.oracle],
    queryFn: () => readOracle(deployment.data!),
    enabled: Boolean(deployment.data),
    refetchInterval: 20_000,
  })
  return {
    privy,
    wallet,
    wallets,
    walletsReady,
    account,
    emailWallet,
    engineConfig,
    deployment,
    balance,
    ethBalance,
    oracle,
  }
}
