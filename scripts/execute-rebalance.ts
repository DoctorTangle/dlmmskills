/**
 * Local signed rebalance: batched remove + add using PRIVATE_KEY.
 */
import { getAddress } from 'viem'
import { createBasePublicClient } from '../src/lib/client.js'
import { buildAddLiquidityCalls, buildRemoveLiquidityBatches, discoverLpBins, parseDistribution, scaleLiquidityBalances, fetchUserLiquidityBalances } from '../src/lib/dlmm.js'
import { parseBinCount, SUGGESTED_REMOVE_BATCH_SIZE } from '../src/lib/bin-range.js'
import { makeToken, WETH_ADDRESS } from '../src/lib/tokens.js'
import { parseLbVersion } from '../src/lib/validation.js'
import { parseTokenAmount } from '../src/lib/amounts.js'
import {
  createClients,
  envBool,
  parsePrivateKey,
  sendCalls,
  wrapWethIfNeeded,
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
  const binCount = parseBinCount(Number(requireEnv('BIN_COUNT')))
  const batchSize = parseBinCount(Number(process.env.REMOVE_BATCH_SIZE ?? String(SUGGESTED_REMOVE_BATCH_SIZE)))
  const scanBins = parseBinCount(Number(process.env.SCAN_BINS ?? String(Math.max(binCount, 60))))
  const distribution = parseDistribution(requireEnv('DISTRIBUTION'))

  const client = createBasePublicClient()

  const discovered = await discoverLpBins({
    client,
    wallet,
    pair,
    version,
    scanBins
  })
  const binIds = discovered.bins.map((b) => b.id)
  if (binIds.length === 0) {
    throw new Error('No LP bins found for rebalance remove leg.')
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
      label: `remove batch ${batch.batchIndex + 1}`
    })
  }

  const wethIsX = getAddress(tokenX.address) === getAddress(WETH_ADDRESS)
  const wethIsY = getAddress(tokenY.address) === getAddress(WETH_ADDRESS)
  const wethNeeded =
    wethIsX && Number(requireEnv('AMOUNT_X')) > 0
      ? parseTokenAmount(requireEnv('AMOUNT_X'), tokenX.decimals)
      : wethIsY && Number(requireEnv('AMOUNT_Y')) > 0
        ? parseTokenAmount(requireEnv('AMOUNT_Y'), tokenY.decimals)
        : 0n

  if (wethNeeded > 0n) {
    await wrapWethIfNeeded({
      publicClient,
      walletClient,
      weth: WETH_ADDRESS,
      wallet,
      needed: wethNeeded,
      dryRun
    })
  }

  const buildAdd = () =>
    buildAddLiquidityCalls({
      client,
      wallet,
      tokenX,
      tokenY,
      amountX: requireEnv('AMOUNT_X'),
      amountY: requireEnv('AMOUNT_Y'),
      tokenXDecimals: tokenX.decimals,
      tokenYDecimals: tokenY.decimals,
      binStep,
      version,
      amountSlippageBps: Number(process.env.AMOUNT_SLIPPAGE_BPS ?? '50'),
      priceSlippageBps: Number(process.env.PRICE_SLIPPAGE_BPS ?? '50'),
      distribution,
      ttl: Number(process.env.TTL_SECONDS ?? '1200'),
      binCount
    })

  let add = await buildAdd()
  if (add.approvalCalls > 0) {
    await sendCalls({
      walletClient,
      publicClient,
      calls: add.calls.slice(0, add.approvalCalls),
      dryRun,
      label: 'approve'
    })
    add = await buildAdd()
  }

  await sendCalls({
    walletClient,
    publicClient,
    calls: add.calls.slice(add.approvalCalls),
    dryRun,
    label: 'addLiquidity'
  })

  console.error(`Rebalance done. ${remove.batches.length} remove batch(es), add ${add.binCount} bins (${requireEnv('DISTRIBUTION')}).`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
