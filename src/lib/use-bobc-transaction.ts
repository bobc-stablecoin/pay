import { useSendTransaction } from '@privy-io/react-auth'
import { useState } from 'react'
import { encodeFunctionData, zeroAddress, type Address, type Hex } from 'viem'
import { CHAIN_ID, MAX_REDEEM_STEPS, publicClient } from './chain'
import { engineAbi, erc20Abi, readBalance, readOracle } from './protocol'
import { useTransactions } from '../components/transaction-provider'
import type { useAppState } from './use-app-state'
import { hasEnoughGas, transactionErrorMessage } from './wallet-policy'

type AppState = ReturnType<typeof useAppState>

export function useBobcTransaction(state: AppState) {
  const { sendTransaction } = useSendTransaction()
  const { add } = useTransactions()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(
    label: string,
    to: Address,
    data: Hex,
    validate: () => Promise<void>,
  ) {
    if (busy) return false
    setBusy(true)
    setError(null)
    try {
      const { wallet, account, emailWallet } = state
      if (!wallet || !account) throw new Error('Sign in to continue.')
      if (wallet.chainId !== `eip155:${CHAIN_ID}`)
        await wallet.switchChain(CHAIN_ID)
      const provider = await wallet.getEthereumProvider()
      const chain = await provider.request({ method: 'eth_chainId' })
      const providerAccounts = await provider.request({
        method: 'eth_accounts',
      })
      if (
        chain !== `0x${CHAIN_ID.toString(16)}` ||
        !Array.isArray(providerAccounts) ||
        !providerAccounts.some(
          (value) =>
            typeof value === 'string' &&
            value.toLowerCase() === account.toLowerCase(),
        )
      ) {
        throw new Error(
          'Wallet account or network changed. Review the transaction again.',
        )
      }
      await validate()
      if (!emailWallet) {
        const [gas, fees, eth] = await Promise.all([
          publicClient.estimateGas({ account, to, data }),
          publicClient.estimateFeesPerGas(),
          publicClient.getBalance({ address: account }),
        ])
        if (!hasEnoughGas(eth, gas, fees.maxFeePerGas))
          throw new Error('Your wallet needs more ETH for Arbitrum gas.')
      }
      const { hash } = await sendTransaction(
        { to, data, value: 0, chainId: CHAIN_ID },
        { address: account, sponsor: emailWallet },
      )
      add({ hash, account, label })
      return true
    } catch (cause) {
      setError(transactionErrorMessage(cause, state.emailWallet))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function sendPayment(recipient: Address, amount: bigint) {
    const deployment = state.deployment.data
    if (!deployment) {
      setError('BOBC is not deployed or configured yet.')
      return false
    }
    if (!state.account) {
      setError('Sign in to pay.')
      return false
    }
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amount],
    })
    return submit('BOBC payment', deployment.bobc, data, async () => {
      const account = state.account!
      if (
        amount <= 0n ||
        recipient.toLowerCase() === account.toLowerCase() ||
        recipient.toLowerCase() === zeroAddress
      )
        throw new Error('Enter a valid amount and another recipient.')
      const balance = await readBalance(deployment.bobc, account)
      if (amount > balance)
        throw new Error('This payment exceeds your BOBC balance.')
      const simulated = await publicClient.simulateContract({
        address: deployment.bobc,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient, amount],
        account,
      })
      if (!simulated.result)
        throw new Error('The BOBC transfer simulation did not succeed.')
    })
  }

  async function sendRedemption(amount: bigint) {
    const deployment = state.deployment.data
    if (!deployment) {
      setError('BOBC redemption is not configured yet.')
      return false
    }
    if (!state.account) {
      setError('Sign in to redeem.')
      return false
    }
    const data = encodeFunctionData({
      abi: engineAbi,
      functionName: 'redeem',
      args: [amount, MAX_REDEEM_STEPS],
    })
    return submit('Redeem BOBC', deployment.engine, data, async () => {
      const account = state.account!
      if (amount <= 0n) throw new Error('Enter a valid BOBC amount.')
      const [balance, oracle] = await Promise.all([
        readBalance(deployment.bobc, account),
        readOracle(deployment),
      ])
      if (amount > balance)
        throw new Error('This redemption exceeds your BOBC balance.')
      if (!oracle.fresh) throw new Error('The oracle rate is stale.')
      const simulated = await publicClient.simulateContract({
        address: deployment.engine,
        abi: engineAbi,
        functionName: 'redeem',
        args: [amount, MAX_REDEEM_STEPS],
        account,
      })
      if (simulated.result <= 0n)
        throw new Error('No crvUSD is available to redeem at the moment.')
    })
  }

  return {
    busy,
    error,
    clearError: () => setError(null),
    sendPayment,
    sendRedemption,
  }
}
