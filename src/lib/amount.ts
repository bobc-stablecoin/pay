import { formatUnits, maxUint256, parseUnits } from 'viem'

export function parseBobcAmount(value: string): bigint | undefined {
  const trimmed = value.trim()
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(trimmed)) return undefined
  try {
    const amount = parseUnits(trimmed, 18)
    return amount > 0n && amount <= maxUint256 ? amount : undefined
  } catch {
    return undefined
  }
}

export function formatToken(value: bigint, maxFractionDigits = 2): string {
  const fixed = formatUnits(value, 18)
  const [whole, fraction = ''] = fixed.split('.')
  const grouped = BigInt(whole).toLocaleString('en-US')
  const visible = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
  return visible ? `${grouped}.${visible}` : grouped
}

export function formatExact(value: bigint): string {
  return formatUnits(value, 18)
}
