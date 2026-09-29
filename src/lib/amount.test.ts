import { describe, expect, it } from 'vitest'
import { formatToken, parseBobcAmount } from './amount'
import { isOracleFresh } from './protocol'

describe('token and redemption inputs', () => {
  it('parses BOBC amounts exactly and rejects invalid units', () => {
    expect(parseBobcAmount('1.000000000000000001')).toBe(1000000000000000001n)
    expect(parseBobcAmount('0')).toBeUndefined()
    expect(parseBobcAmount('1.1234567890123456789')).toBeUndefined()
    expect(parseBobcAmount('1e18')).toBeUndefined()
    expect(formatToken(1234567890000000000000n)).toBe('1,234.56')
  })

  it('blocks zero, future, and stale oracle samples', () => {
    expect(isOracleFresh(13n, 90n, 100n, 10n)).toBe(true)
    expect(isOracleFresh(0n, 90n, 100n, 10n)).toBe(false)
    expect(isOracleFresh(13n, 101n, 100n, 10n)).toBe(false)
    expect(isOracleFresh(13n, 89n, 100n, 10n)).toBe(false)
  })
})
