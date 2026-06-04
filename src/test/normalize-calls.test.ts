import { describe, expect, it } from 'vitest'
import { analyzeCalls, normalizeCalls } from '../lib/normalize-calls.js'
import { SectorOneError } from '../lib/errors.js'

const ROUTER_V22 = '0x87aC1EB5596D47f6fd7d0D17bEE233783dB5CfEC'
const RANDOM_TARGET = '0x1111111111111111111111111111111111111111'
const APPROVE_DATA = '0x095ea7b3000000000000000000000000'

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

describe('analyzeCalls / strict mode', () => {
  it('flags an ERC-20 approve to an arbitrary token as known', () => {
    const payload = normalizeCalls([
      { to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', data: APPROVE_DATA }
    ])
    const [risk] = analyzeCalls(payload)
    expect(risk?.isApprove).toBe(true)
    expect(risk?.known).toBe(true)
    expect(risk?.selector).toBe('0x095ea7b3')
  })

  it('flags a call to a known SectorOne router as known', () => {
    const payload = normalizeCalls([{ to: ROUTER_V22, data: '0xdeadbeef' }])
    const [risk] = analyzeCalls(payload)
    expect(risk?.knownTarget).toBe(true)
    expect(risk?.known).toBe(true)
  })

  it('flags an unknown target+selector and strict mode rejects it', () => {
    const payload = normalizeCalls([{ to: RANDOM_TARGET, data: '0xdeadbeef' }])
    const [risk] = analyzeCalls(payload)
    expect(risk?.known).toBe(false)

    expect(() =>
      normalizeCalls([{ to: RANDOM_TARGET, data: '0xdeadbeef' }], { strict: true })
    ).toThrow(SectorOneError)
  })

  it('strict mode passes approves and known routers', () => {
    expect(() =>
      normalizeCalls(
        [
          { to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', data: APPROVE_DATA },
          { to: ROUTER_V22, data: '0xabcdabcd' }
        ],
        { strict: true }
      )
    ).not.toThrow()
  })
})
