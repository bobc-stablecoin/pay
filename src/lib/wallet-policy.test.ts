import { describe, expect, it } from 'vitest'
import {
  hasEnoughGas,
  isSponsoredEmailWallet,
  transactionErrorMessage,
} from './wallet-policy'

describe('wallet transaction policy', () => {
  it('sponsors only an email account using its Privy embedded wallet', () => {
    expect(isSponsoredEmailWallet(true, 'privy')).toBe(true)
    expect(isSponsoredEmailWallet(true, 'privy-v2')).toBe(true)
    expect(isSponsoredEmailWallet(false, 'privy')).toBe(false)
    expect(isSponsoredEmailWallet(true, 'metamask')).toBe(false)
  })

  it('requires an external wallet to cover gas with a buffer', () => {
    expect(hasEnoughGas(120n, 10n, 10n)).toBe(true)
    expect(hasEnoughGas(119n, 10n, 10n)).toBe(false)
  })

  it('distinguishes rejection and sponsorship failure', () => {
    expect(
      transactionErrorMessage(new Error('User rejected request'), false),
    ).toMatch(/cancelled/)
    expect(
      transactionErrorMessage(
        new Error('Paymaster sponsorship unavailable'),
        true,
      ),
    ).toMatch(/Sponsored gas/)
    expect(
      transactionErrorMessage(new Error('insufficient funds for gas'), false),
    ).toMatch(/more ETH/)
    expect(
      transactionErrorMessage(new Error('BOBC: insufficient balance'), false),
    ).toMatch(/BOBC/)
  })
})
