import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { createPaymentUri, parsePaymentUri } from './qr'

const token = getAddress('0x1111111111111111111111111111111111111111')
const recipient = getAddress('0x2222222222222222222222222222222222222222')

describe('BOBC payment QR', () => {
  it('round-trips a requested amount in base units', () => {
    const request = { recipient, amount: 1250000000000000000n }
    expect(parsePaymentUri(createPaymentUri(token, request), token)).toEqual(
      request,
    )
  })

  it('supports an amount chosen by the payer and pasted addresses', () => {
    expect(
      parsePaymentUri(createPaymentUri(token, { recipient }), token),
    ).toEqual({ recipient })
    expect(parsePaymentUri(recipient, token)).toEqual({ recipient })
  })

  it('accepts standard scientific notation without floating point conversion', () => {
    expect(
      parsePaymentUri(
        `ethereum:${token}@42161/transfer?address=${recipient}&uint256=1.5e18`,
        token,
      ).amount,
    ).toBe(1500000000000000000n)
  })

  it('rejects another token, chain, malformed amount, or extra instructions', () => {
    expect(() =>
      parsePaymentUri(
        `ethereum:0x3333333333333333333333333333333333333333@42161/transfer?address=${recipient}`,
        token,
      ),
    ).toThrow(/different token/)
    expect(() =>
      parsePaymentUri(
        `ethereum:${token}@1/transfer?address=${recipient}`,
        token,
      ),
    ).toThrow(/different network/)
    expect(() =>
      parsePaymentUri(
        `ethereum:${token}@42161/transfer?address=${recipient}&uint256=0`,
        token,
      ),
    ).toThrow(/invalid BOBC amount/)
    expect(() =>
      parsePaymentUri(
        `ethereum:${token}@42161/transfer?address=${recipient}&uint256=1&uint256=2`,
        token,
      ),
    ).toThrow(/unsupported/)
    expect(() =>
      parsePaymentUri(
        `ethereum:${token}@42161/transfer?address=${recipient}&value=1`,
        token,
      ),
    ).toThrow(/unsupported/)
    expect(() =>
      parsePaymentUri(`ethereum:${recipient}@42161?value=1`, token),
    ).toThrow(/Scan a BOBC/)
    expect(() =>
      parsePaymentUri('0x0000000000000000000000000000000000000000', token),
    ).toThrow(/zero address/)
  })
})
