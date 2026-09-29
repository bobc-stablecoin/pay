import {
  getAddress,
  isAddress,
  maxUint256,
  zeroAddress,
  type Address,
} from 'viem'
import { CHAIN_ID } from './chain'

export type PaymentRequest = { recipient: Address; amount?: bigint }

export function createPaymentUri(
  token: Address,
  request: PaymentRequest,
): string {
  const uri = `ethereum:${token}@${CHAIN_ID}/transfer?address=${request.recipient}`
  return request.amount ? `${uri}&uint256=${request.amount}` : uri
}

function parseInteger(value: string): bigint | undefined {
  const match = /^(\d+)(?:\.(\d+))?(?:[eE](\d+))?$/.exec(value)
  if (!match) return undefined
  const digits = `${match[1]}${match[2] ?? ''}`
  const exponent = Number(match[3] ?? '0') - (match[2]?.length ?? 0)
  if (
    digits.length > 78 ||
    exponent < 0 ||
    exponent > 77 ||
    digits.length + exponent > 78
  )
    return undefined
  const amount = BigInt(digits) * 10n ** BigInt(exponent)
  return amount > 0n && amount <= maxUint256 ? amount : undefined
}

export function parsePaymentUri(input: string, token: Address): PaymentRequest {
  const value = input.trim()
  if (isAddress(value)) {
    if (value.toLowerCase() === zeroAddress)
      throw new Error('The zero address cannot receive BOBC payments.')
    return { recipient: getAddress(value) }
  }
  const match = /^ethereum:(0x[a-fA-F0-9]{40})@(\d+)\/transfer\?(.+)$/i.exec(
    value,
  )
  if (!match)
    throw new Error('Scan a BOBC payment QR or paste an Arbitrum address.')
  if (match[1].toLowerCase() !== token.toLowerCase())
    throw new Error('This QR requests a different token, not BOBC.')
  if (Number(match[2]) !== CHAIN_ID)
    throw new Error('This QR is for a different network, not Arbitrum One.')
  const params = new URLSearchParams(match[3])
  const recipient = params.get('address')
  if (
    !recipient ||
    !isAddress(recipient) ||
    params.getAll('address').length !== 1
  )
    throw new Error('This QR has an invalid recipient.')
  if (recipient.toLowerCase() === zeroAddress)
    throw new Error('The zero address cannot receive BOBC payments.')
  const rawAmount = params.get('uint256')
  if (
    params.getAll('uint256').length > 1 ||
    [...params.keys()].some((key) => key !== 'address' && key !== 'uint256')
  ) {
    throw new Error('This QR contains unsupported payment details.')
  }
  const amount = rawAmount === null ? undefined : parseInteger(rawAmount)
  if (rawAmount !== null && amount === undefined)
    throw new Error('This QR has an invalid BOBC amount.')
  return { recipient: getAddress(recipient), amount }
}
