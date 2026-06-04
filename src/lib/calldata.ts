import { encodeFunctionData, type Abi, type Hex } from 'viem'
import type { McpCall } from './types.js'

export function encodeRouterCall(params: {
  abi: Abi
  functionName: string
  args: readonly unknown[]
}): Hex {
  return encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName as never,
    args: params.args as never
  })
}

export function toMcpCall(to: `0x${string}`, data: Hex, value?: bigint | string): McpCall {
  let hexValue: `0x${string}` = '0x0'
  if (value !== undefined && value !== '0x0' && value !== 0n && value !== '0') {
    const asBig =
      typeof value === 'string' && value.startsWith('0x')
        ? BigInt(value)
        : BigInt(value)
    hexValue = `0x${asBig.toString(16)}` as `0x${string}`
  }
  return { to, data, value: hexValue }
}
