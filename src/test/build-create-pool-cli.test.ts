import { describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'

const BASE_ARGS = [
  'build-create-pool',
  '--token-x',
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  '--token-y',
  '0x4200000000000000000000000000000000000006',
  '--token-x-decimals',
  '6',
  '--token-y-decimals',
  '18',
  '--bin-step',
  '25'
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

describe('build-create-pool CLI', () => {
  it('is registered in --help', () => {
    const { status, combined } = runSectorone('--help')
    expect(status).toBe(0)
    expect(combined).toContain('build-create-pool')
  })

  it('documents price flags on subcommand help', () => {
    const { status, combined } = runSectorone('build-create-pool --help')
    expect(status).toBe(0)
    expect(combined).toContain('price-token-y-per-token-x')
    expect(combined).toContain('price-sorted-y-per-sorted-x')
  })

  it('requires --confirm-create', () => {
    const { status, combined } = runSectorone(BASE_ARGS)
    expect(status).not.toBe(0)
    expect(combined).toMatch(/CONFIRM_CREATE_REQUIRED/)
  })

  it('rejects legacy --price flag', () => {
    const { status, combined } = runSectorone(
      `${BASE_ARGS} --confirm-create --price 3000`
    )
    expect(status).not.toBe(0)
  })

  it('rejects --price-sorted when token-x is not token0 (USDC before WETH)', () => {
    const args = [
      'build-create-pool',
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
      '--price-sorted-y-per-sorted-x',
      '3000',
      '--confirm-create'
    ].join(' ')
    const { status, combined } = runSectorone(args)
    expect(status).not.toBe(0)
    expect(combined).toMatch(/PRICE_REQUIRES_SORTED_INPUT_ORDER/)
  })

  it('rejects two price modes together', () => {
    const { status, combined } = runSectorone(
      `${BASE_ARGS} --confirm-create --price-token-y-per-token-x 1 --price-sorted-y-per-sorted-x 1`
    )
    expect(status).not.toBe(0)
    expect(combined).toMatch(/CREATE_PRICE_MODE_REQUIRED/)
  })
})
