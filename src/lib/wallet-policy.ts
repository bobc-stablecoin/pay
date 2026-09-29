export function isSponsoredEmailWallet(
  hasEmail: boolean,
  walletClientType?: string,
): boolean {
  return (
    hasEmail &&
    (walletClientType === 'privy' || walletClientType === 'privy-v2')
  )
}

export function hasEnoughGas(
  eth: bigint,
  gas: bigint,
  maxFeePerGas: bigint,
): boolean {
  return eth >= (gas * maxFeePerGas * 12n) / 10n
}

export function transactionErrorMessage(
  error: unknown,
  sponsored: boolean,
): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/reject|denied|cancel|user refused/i.test(raw))
    return 'Transaction cancelled. Nothing was sent.'
  if (sponsored && /sponsor|paymaster|credit|billing|fee/i.test(raw))
    return 'Sponsored gas is unavailable right now. Please try again later.'
  if (
    /insufficient funds.*gas|insufficient funds for (intrinsic|transaction)|needs more ETH/i.test(
      raw,
    )
  )
    return 'Your wallet needs more ETH for Arbitrum gas.'
  if (/stale|oracle/i.test(raw))
    return 'The redemption rate is unavailable or stale. Try again when it updates.'
  return raw.length < 180
    ? raw
    : 'The transaction could not be completed. Please try again.'
}
