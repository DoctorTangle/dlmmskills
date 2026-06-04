import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, erc20Abi } from 'viem'
import type { BasePublicClient } from '../lib/client.js'
import { buildApprovalIfNeeded } from '../lib/approvals.js'

describe('buildApprovalIfNeeded', () => {
  it('encodes approve(spender, amount) when allowance is low', async () => {
    const token = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    const wallet = '0x0000000000000000000000000000000000000001'
    const spender = '0x87aC1EB5596D47f6fd7d0D17bEE233783dB5CfEC'
    const amount = 100_000_000n

    const client = {
      readContract: vi.fn().mockResolvedValue(0n)
    } as unknown as BasePublicClient

    const result = await buildApprovalIfNeeded({
      client,
      wallet,
      token,
      spender,
      amount
    })

    expect(result.approvalNeeded).toBe(true)
    const expected = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender, amount]
    })
    expect(result.call?.data).toBe(expected)
    expect(result.call?.to).toBe(token)
    expect(result.call?.value).toBe('0x0')
  })
})
