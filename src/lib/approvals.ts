import { encodeFunctionData, erc20Abi, maxUint256, type Address, type Hex } from 'viem'
import type { BasePublicClient } from './client.js'

export async function buildApprovalIfNeeded(params: {
  client: BasePublicClient
  wallet: Address
  token: Address
  spender: Address
  amount: bigint
  infinite?: boolean
}): Promise<{
  approvalNeeded: boolean
  call?: {
    to: Address
    data: Hex
    value: '0x0'
  }
}> {
  const allowance = await params.client.readContract({
    address: params.token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [params.wallet, params.spender]
  })

  if (allowance >= params.amount) {
    return { approvalNeeded: false }
  }

  const approveAmount = params.infinite ? maxUint256 : params.amount
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [params.spender, approveAmount]
  })

  return {
    approvalNeeded: true,
    call: {
      to: params.token,
      data,
      value: '0x0'
    }
  }
}
