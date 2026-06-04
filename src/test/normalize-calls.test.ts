import { describe, expect, it } from 'vitest'
import { normalizeCalls } from '../lib/normalize-calls.js'
import { SectorOneError } from '../lib/errors.js'

describe('normalizeCalls', () => {
  it('removes from and preserves order', () => {
    const result = normalizeCalls([
      {
        from: '0x0000000000000000000000000000000000000001',
        to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        data: '0x1234',
        value: 0
      },
      {
        to: '0x87aC1EB5596D47f6fd7d0D17bEE233783dB5CfEC',
        data: '0xabcd',
        value: '0x0'
      }
    ])

    expect(result.chain).toBe('base')
    expect(result.calls).toHaveLength(2)
    expect(result.calls[0]?.to).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
    expect(result.calls[1]?.to).toBe('0x87aC1EB5596D47f6fd7d0D17bEE233783dB5CfEC')
    expect('from' in (result.calls[0] as object)).toBe(false)
  })

  it('converts decimal value to hex', () => {
    const result = normalizeCalls([
      {
        to: '0x87aC1EB5596D47f6fd7d0D17bEE233783dB5CfEC',
        data: '0x',
        value: 1000
      }
    ])
    expect(result.calls[0]?.value).toBe('0x3e8')
  })

  it('keeps hex value unchanged', () => {
    const result = normalizeCalls([
      {
        to: '0x87aC1EB5596D47f6fd7d0D17bEE233783dB5CfEC',
        value: '0xe8d4a51000'
      }
    ])
    expect(result.calls[0]?.value).toBe('0xe8d4a51000')
  })

  it('fills missing data with 0x', () => {
    const result = normalizeCalls([
      {
        to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        value: 0
      }
    ])
    expect(result.calls[0]?.data).toBe('0x')
  })

  it('rejects malformed (odd-length / non-hex) data', () => {
    expect(() =>
      normalizeCalls([
        {
          to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          data: '0x123' as `0x${string}`
        }
      ])
    ).toThrow(SectorOneError)
    expect(() =>
      normalizeCalls([
        {
          to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          data: 'deadbeef' as `0x${string}`
        }
      ])
    ).toThrow(SectorOneError)
  })

  it('rejects negative value', () => {
    expect(() =>
      normalizeCalls([
        {
          to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          value: -1
        }
      ])
    ).toThrow(SectorOneError)
  })
})
