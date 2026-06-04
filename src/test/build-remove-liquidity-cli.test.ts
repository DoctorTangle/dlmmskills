import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'

const BASE_ARGS = [
  'build-remove-liquidity',
  '--wallet',
  '0x0000000000000000000000000000000000000001',
  '--token-x',
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  '--token-y',
  '0x4200000000000000000000000000000000000006',
  '--token-x-decimals',
  '6',
  '--token-y-decimals',
  '18',
  '--bin-step',
  '25',
  '--bin-ids',
  '8376297'
].join(' ')

function runSectorone(args: string): { status: number; combined: string } {
  try {
    const out = execSync(`npx tsx src/cli/sectorone.ts ${args}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
      env: { ...process.env, BASE_RPC_URL: process.env.BASE_RPC_URL ?? '' }
    })
    return { status: 0, combined: out }
  } catch (err) {
    const e = err as {
      status?: number
      stdout?: string | Buffer
      stderr?: string | Buffer
    }
    const stdout = e.stdout?.toString() ?? ''
    const stderr = e.stderr?.toString() ?? ''
    return { status: e.status ?? 1, combined: `${stdout}${stderr}` }
  }
}

describe('build-remove-liquidity CLI', () => {
  it('is registered in --help', () => {
    const { status, combined } = runSectorone('--help')
    expect(status).toBe(0)
    expect(combined).toContain('build-remove-liquidity')
  })

  it('requires exactly one of --remove-all, --fraction, --amounts', () => {
    const { status, combined } = runSectorone(BASE_ARGS)
    expect(status).not.toBe(0)
    expect(combined).toMatch(/REMOVE_MODE_REQUIRED/)
  })

  it('rejects --fraction and --remove-all together', () => {
    const { status, combined } = runSectorone(`${BASE_ARGS} --remove-all --fraction 0.5`)
    expect(status).not.toBe(0)
    expect(combined).toMatch(/REMOVE_MODE_REQUIRED/)
  })
})
