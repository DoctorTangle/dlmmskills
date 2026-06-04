import { getAddress, isAddress, type Hex } from 'viem'
import type { BaseMcpPayload, RawUnsignedCall } from './types.js'
import { SectorOneError } from './errors.js'

function toHexValue(value: RawUnsignedCall['value']): `0x${string}` {
  if (value === undefined || value === null) return '0x0'
  if (typeof value === 'string' && value.startsWith('0x')) {
    return value as `0x${string}`
  }
  const asBig = typeof value === 'bigint' ? value : BigInt(value)
  if (asBig === 0n) return '0x0'
  return `0x${asBig.toString(16)}` as `0x${string}`
}

export function normalizeCalls(input: RawUnsignedCall[]): BaseMcpPayload {
  const calls = input.map((raw, index) => {
    if (!raw.to || !isAddress(raw.to)) {
      throw new SectorOneError(
        'INVALID_CALL',
        `Call at index ${index} has an invalid "to" address.`
      )
    }
    const data = (raw.data ?? '0x') as Hex
    return {
      to: getAddress(raw.to),
      data,
      value: toHexValue(raw.value)
    }
  })

  return { chain: 'base', calls }
}
