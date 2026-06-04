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

  it('requires --confirm-create', () => {
    const { status, combined } = runSectorone(BASE_ARGS)
    expect(status).not.toBe(0)
    expect(combined).toMatch(/CONFIRM_CREATE_REQUIRED/)
  })

  it('rejects --active-id and --price together', () => {
    const { status, combined } = runSectorone(
      `${BASE_ARGS} --confirm-create --active-id 8388608 --price 3000`
    )
    expect(status).not.toBe(0)
    expect(combined).toMatch(/ACTIVE_ID_OR_PRICE/)
  })
})
