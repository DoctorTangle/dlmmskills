import { describe, expect, it } from 'vitest'
import { normalizeCalls } from '../lib/normalize-calls.js'

const runLive =
  process.env.SECTORONE_INTEGRATION_TESTS === '1' &&
  Boolean(process.env.BASE_RPC_URL)

describe.runIf(runLive)('integration (live RPC)', () => {
  it('list-pairs USDC/WETH returns v2 pools', async () => {
    const { execSync } = await import('node:child_process')
    const out = execSync(
      'npx tsx src/cli/sectorone.ts list-pairs --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --token-out 0x4200000000000000000000000000000000000006 --token-in-decimals 6 --token-out-decimals 18 --lb-version v2 --json',
      {
        encoding: 'utf8',
        env: process.env,
        cwd: process.cwd()
      }
    )
    const json = JSON.parse(out) as { pairs: unknown[]; version: string }
    expect(json.version).toBe('v2')
    expect(json.pairs.length).toBeGreaterThan(0)
  })

  it('build-swap returns base chain and v2 router', async () => {
    const { execSync } = await import('node:child_process')
    const out = execSync(
      'npx tsx src/cli/sectorone.ts build-swap --wallet 0x0000000000000000000000000000000000000001 --token-in 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --token-out 0x4200000000000000000000000000000000000006 --token-in-decimals 6 --token-out-decimals 18 --amount-in 100 --slippage-bps 50 --json',
      {
        encoding: 'utf8',
        env: process.env,
        cwd: process.cwd()
      }
    )
    const json = JSON.parse(out) as {
      chain: string
      summary: { router: string }
      calls: { to: string }[]
    }
    expect(json.chain).toBe('base')
    expect(json.summary.router.toLowerCase()).toBe(
      '0xd4f937581650a2d6e416dd9ef5372c1672422843'
    )
    expect(json.calls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('integration helpers', () => {
  it('normalize-calls produces send_calls shape', () => {
    const payload = normalizeCalls([
      { to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', data: '0x', value: 0 }
    ])
    expect(payload.chain).toBe('base')
    expect(payload.calls[0]?.value).toBe('0x0')
  })
})
