import { getAddress, isAddress } from 'viem'
import { z } from 'zod'
import type { LbVersion, SlippageLevel } from './types.js'
import { SectorOneError } from './errors.js'

const addressSchema = z
  .string()
  .refine((v) => isAddress(v), 'Invalid Ethereum address')
  .transform((v) => getAddress(v))

export const addressValidator = addressSchema

export function parseAddress(value: string, label = 'address'): `0x${string}` {
  const parsed = addressSchema.safeParse(value)
  if (!parsed.success) {
    throw new SectorOneError('INVALID_ADDRESS', `Invalid ${label}: ${value}`)
  }
  return parsed.data
}

export function parseDecimals(value: number, label = 'decimals'): number {
  if (!Number.isInteger(value) || value < 0 || value > 36) {
    throw new SectorOneError(
      'INVALID_DECIMALS',
      `${label} must be an integer between 0 and 36.`
    )
  }
  return value
}

export function parseLbVersion(value: string): LbVersion {
  if (value === 'v21') {
    throw new SectorOneError(
      'UNSUPPORTED_VERSION',
      'LB v2.1 is not deployed on Base. Use v22 (default) or v2.'
    )
  }
  if (value !== 'v2' && value !== 'v22') {
    throw new SectorOneError(
      'INVALID_VERSION',
      `Unsupported version "${value}". Use v2 or v22.`
    )
  }
  return value
}

export function parseSlippageBps(bps: number): number {
  if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
    throw new SectorOneError(
      'INVALID_SLIPPAGE',
      'Slippage bps must be between 0 and 10000 (100%).'
    )
  }
  return Math.trunc(bps)
}

export function slippageLevel(bps: number): SlippageLevel {
  if (bps <= 100) return 'normal'
  if (bps <= 500) return 'elevated'
  if (bps <= 2000) return 'high'
  return 'very_high'
}

export function assertSlippageSafe(bps: number, strict = false): SlippageLevel {
  const level = slippageLevel(bps)
  if (strict && level === 'very_high') {
    throw new SectorOneError(
      'UNSAFE_SLIPPAGE',
      `Slippage ${bps} bps (${bps / 100}%) is very high. Re-confirm with the user before proceeding.`
    )
  }
  return level
}

export function parseTtlSeconds(ttl: number): number {
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new SectorOneError('INVALID_TTL', 'TTL must be a positive number of seconds.')
  }
  return Math.trunc(ttl)
}

export function assertBaseChainOnly(chainId?: number): void {
  if (chainId !== undefined && chainId !== 8453) {
    throw new SectorOneError(
      'WRONG_CHAIN',
      'SectorOne Base MCP skill supports Base mainnet only (chainId 8453).'
    )
  }
}
