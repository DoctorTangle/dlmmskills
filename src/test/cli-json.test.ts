import { describe, expect, it } from 'vitest'
import { normalizeCalls } from '../lib/normalize-calls.js'

describe('CLI JSON payloads', () => {
  it('normalize-calls output is parseable JSON shape', () => {
    const payload = normalizeCalls([
      {
        to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        data: '0x095ea7b3000000000000000000000000',
        value: 0
      }
    ])

    const serialized = JSON.stringify(payload)
    const parsed = JSON.parse(serialized) as typeof payload
    expect(parsed.chain).toBe('base')
    expect(parsed.calls[0]?.value).toMatch(/^0x/)
  })
})
