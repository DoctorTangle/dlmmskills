import 'dotenv/config'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function envBool(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function createClients(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey)
  const rpc = requireEnv('BASE_RPC_URL')
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpc)
  })
  return { account, publicClient, walletClient }
}

const wethDepositAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  }
] as const

export async function wrapWethIfNeeded(params: {
  publicClient: ReturnType<typeof createPublicClient>
  walletClient: ReturnType<typeof createWalletClient>
  weth: Address
  wallet: Address
  needed: bigint
  dryRun: boolean
}): Promise<void> {
  if (params.needed <= 0n) return
  const balance = await params.publicClient.readContract({
    address: params.weth,
    abi: [
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }]
      }
    ],
    functionName: 'balanceOf',
    args: [params.wallet]
  })
  if (balance >= params.needed) return

  const shortfall = params.needed - balance
  console.error(`Wrapping ${shortfall} wei to WETH before add liquidity.`)
  if (params.dryRun) return

  const hash = await params.walletClient.writeContract({
    address: params.weth,
    abi: wethDepositAbi,
    functionName: 'deposit',
    value: shortfall
  })
  await params.publicClient.waitForTransactionReceipt({ hash })
}

export async function sendCalls(params: {
  walletClient: ReturnType<typeof createWalletClient>
  publicClient: ReturnType<typeof createPublicClient>
  calls: { to: Address; data: Hex; value?: bigint | string }[]
  dryRun: boolean
  label: string
}): Promise<void> {
  for (const [i, call] of params.calls.entries()) {
    const value =
      call.value === undefined || call.value === '0x0' || call.value === 0n
        ? 0n
        : BigInt(call.value)
    console.error(`${params.label} call ${i + 1}/${params.calls.length} → ${call.to}`)
    if (params.dryRun) continue
    const hash = await params.walletClient.sendTransaction({
      to: call.to,
      data: call.data,
      value
    })
    const receipt = await params.publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`${params.label} call ${i + 1} reverted: ${hash}`)
    }
  }
}

export function parsePrivateKey(): Hex {
  let key = requireEnv('PRIVATE_KEY')
  if (!key.startsWith('0x')) key = `0x${key}`
  return key as Hex
}
