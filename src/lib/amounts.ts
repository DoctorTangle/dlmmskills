import { Percent, Token, TokenAmount } from '@sectorone/sdk-core'
import { JSBI } from '@sectorone/sdk-v2'
import { parseUnits } from 'viem'
import { SectorOneError } from './errors.js'

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const trimmed = amount.trim()
  if (!trimmed || Number(trimmed) <= 0) {
    throw new SectorOneError('INVALID_AMOUNT', 'Amount must be greater than zero.')
  }
  return parseUnits(trimmed, decimals)
}

export function toJSBI(value: bigint): JSBI {
  return JSBI.BigInt(value.toString())
}

export function makeTokenAmount(
  token: Token,
  amount: string,
  decimals: number
): TokenAmount {
  return new TokenAmount(token, toJSBI(parseTokenAmount(amount, decimals)))
}

export function bpsToPercent(bps: number): Percent {
  return new Percent(JSBI.BigInt(Math.trunc(bps)), JSBI.BigInt(10_000))
}

export function formatRawAmount(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const frac = raw % base
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${whole}.${fracStr}`
}
