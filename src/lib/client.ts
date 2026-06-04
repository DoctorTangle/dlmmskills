import { createPublicClient, http, type PublicClient } from 'viem'
import { base } from 'viem/chains'
import { SectorOneError } from './errors.js'

export type BasePublicClient = PublicClient

/** Cast for @sectorone/sdk-v2 when duplicate viem types are present. */
export function asSdkClient(client: BasePublicClient): PublicClient {
  return client as never
}

export function createBasePublicClient(): BasePublicClient {
  const rpcUrl = process.env.BASE_RPC_URL
  if (!rpcUrl) {
    throw new SectorOneError(
      'MISSING_RPC',
      'BASE_RPC_URL is required for live chain reads and tx building.'
    )
  }
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl)
  })
}
