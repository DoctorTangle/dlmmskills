/**
 * Local signed withdraw-only: batched remove liquidity using PRIVATE_KEY.
 * For unsigned calldata use: npm run sectorone -- build-remove-liquidity --batch-size 10 --json
 */
import { getAddress } from 'viem'
import { createBasePublicClient } from '../src/lib/client.js'
import {
  buildRemoveLiquidityBatches,
  discoverLpBins,
  fetchUserLiquidityBalances,
  scaleLiquidityBalances
} from '../src/lib/dlmm.js'
import { parseBinCount, SUGGESTED_REMOVE_BATCH_SIZE } from '../src/lib/bin-range.js'
import { makeToken } from '../src/lib/tokens.js'
import { parseLbVersion, parseBinIds } from '../src/lib/validation.js'
import {
  createClients,
  envBool,
  parsePrivateKey,
  sendCalls,
  requireEnv
} from './execute-common.js'

async function main(): Promise<void> {
  const dryRun = envBool('DRY_RUN', true)
  const privateKey = parsePrivateKey()
  const { account, publicClient, walletClient } = createClients(privateKey)
  const wallet = account.address

  const pair = getAddress(requireEnv('POOL_ADDRESS'))
  const tokenX = makeToken({
    address: requireEnv('TOKEN_X'),
    decimals: Number(requireEnv('TOKEN_X_DECIMALS'))
  })
  const tokenY = makeToken({
    address: requireEnv('TOKEN_Y'),
    decimals: Number(requireEnv('TOKEN_Y_DECIMALS'))
  })
  const binStep = Number(requireEnv('BIN_STEP'))
  const version = parseLbVersion(process.env.LB_VERSION ?? 'v2')
  const batchSize = parseBinCount(
    Number(process.env.REMOVE_BATCH_SIZE ?? String(SUGGESTED_REMOVE_BATCH_SIZE))
  )
  const scanBins = parseBinCount(Number(process.env.SCAN_BINS ?? '60'))

  const client = createBasePublicClient()

  let binIds: number[]
  if (process.env.BIN_IDS?.trim()) {
    binIds = parseBinIds(process.env.BIN_IDS)
  } else {
    const discovered = await discoverLpBins({
      client,
      wallet,
      pair,
      version,
      scanBins
    })
    binIds = discovered.bins.map((b) => b.id)
    if (binIds.length === 0) {
      throw new Error('No LP bins found. Set BIN_IDS or deposit liquidity first.')
    }
    console.error(`Discovered ${binIds.length} LP bin(s): ${binIds.join(', ')}`)
  }

  const balances = await fetchUserLiquidityBalances({
    client,
    version,
    pair,
    wallet,
    binIds
  })
  const liquidityAmounts = scaleLiquidityBalances(balances, 1)

  const remove = await buildRemoveLiquidityBatches({
    client,
    wallet,
    version,
    pair,
    tokenX,
    tokenY,
    binStep,
    binIds,
    liquidityAmounts,
    amountSlippageBps: Number(process.env.AMOUNT_SLIPPAGE_BPS ?? '50'),
    ttl: Number(process.env.TTL_SECONDS ?? '1200'),
    batchSize
  })

  for (const batch of remove.batches) {
    await sendCalls({
      walletClient,
      publicClient,
      calls: batch.calls,
      dryRun,
      label: `remove batch ${batch.batchIndex + 1}/${remove.batches.length}`
    })
  }

  console.error(
    `Withdraw done. ${remove.batches.length} batch(es), ${binIds.length} bin(s), pair ${pair}.`
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
