import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import {
  buildAddLiquidityCalls,
  buildRemoveLiquidityBatches,
  discoverLpBins,
  fetchUserLiquidityBalances,
  parseDistribution,
  resolveLbPair,
  scaleLiquidityBalances
} from '../lib/dlmm.js'
import { parseBinCount, SUGGESTED_REMOVE_BATCH_SIZE } from '../lib/bin-range.js'
import { makeToken } from '../lib/tokens.js'
import {
  assertBaseChainOnly,
  assertSlippageSafe,
  parseAddress,
  parseBinIds,
  parseBinStep,
  parseDecimals,
  parseLbVersion,
  parseSlippageBps,
  parseTtlSeconds
} from '../lib/validation.js'
import { assertInfiniteApprovalConfirmed } from '../lib/safety.js'
import { writeJson, writeHuman, writeWarning } from '../lib/output.js'
import { SectorOneError } from '../lib/errors.js'

export function registerBuildRebalanceLiquidity(program: Command): void {
  program
    .command('build-rebalance-liquidity')
    .description(
      'Build batched remove + add liquidity calls to change distribution/bin count (rebalance)'
    )
    .requiredOption('--wallet <address>')
    .requiredOption('--token-x <address>')
    .requiredOption('--token-y <address>')
    .requiredOption('--token-x-decimals <n>')
    .requiredOption('--token-y-decimals <n>')
    .requiredOption('--amount-x <amount>', 'Amounts for the new add leg')
    .requiredOption('--amount-y <amount>')
    .requiredOption('--bin-step <n>')
    .requiredOption('--distribution <name>', 'SPOT | CURVE | BID_ASK for the new position')
    .requiredOption('--bin-count <n>', 'Target bin count for the new add leg')
    .option('--pair <address>')
    .option('--bin-ids <ids>', 'Bins to remove from (default: discover-lp-bins scan)')
    .option('--scan-bins <n>', 'LP discovery scan width when --bin-ids omitted', '60')
    .option('--remove-batch-size <n>', 'Max bins per remove tx', String(SUGGESTED_REMOVE_BATCH_SIZE))
    .option('--lb-version <v>', 'LB version: v2 or v22', 'v2')
    .option('--amount-slippage-bps <n>', 'Slippage for remove and add', '50')
    .option('--price-slippage-bps <n>', 'Price slippage for add', '50')
    .option('--ttl <n>', 'Deadline TTL seconds', '1200')
    .option('--infinite-approval', 'Infinite ERC-20 approvals on add leg')
    .option('--confirm-infinite-approval')
    .option('--confirm-high-slippage')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      assertBaseChainOnly()
      assertInfiniteApprovalConfirmed(
        Boolean(opts.infiniteApproval),
        Boolean(opts.confirmInfiniteApproval)
      )

      const version = parseLbVersion(opts.lbVersion)
      const binStep = parseBinStep(Number(opts.binStep))
      const binCount = parseBinCount(Number(opts.binCount))
      const scanBins = parseBinCount(Number(opts.scanBins))
      const batchSize = parseBinCount(Number(opts.removeBatchSize))
      const amountSlippageBps = parseSlippageBps(Number(opts.amountSlippageBps))
      const priceSlippageBps = parseSlippageBps(Number(opts.priceSlippageBps))
      const ttl = parseTtlSeconds(Number(opts.ttl))
      const distribution = parseDistribution(opts.distribution)

      const level = assertSlippageSafe(amountSlippageBps, !opts.confirmHighSlippage)
      if (level !== 'normal') {
        writeWarning(`Slippage ${amountSlippageBps} bps is ${level}.`)
      }

      const wallet = parseAddress(opts.wallet, 'wallet')
      const tokenX = makeToken({
        address: opts.tokenX,
        decimals: parseDecimals(Number(opts.tokenXDecimals), 'token-x-decimals')
      })
      const tokenY = makeToken({
        address: opts.tokenY,
        decimals: parseDecimals(Number(opts.tokenYDecimals), 'token-y-decimals')
      })

      const client = createBasePublicClient()
      const pairOpt = opts.pair ? parseAddress(opts.pair, 'pair') : undefined
      const resolved = await resolveLbPair({
        client,
        version,
        pair: pairOpt,
        tokenX,
        tokenY,
        binStep
      })

      let binIds: number[]
      if (opts.binIds) {
        binIds = parseBinIds(opts.binIds)
      } else {
        const discovered = await discoverLpBins({
          client,
          wallet,
          pair: resolved.pairAddress,
          version,
          scanBins: Math.max(scanBins, binCount)
        })
        binIds = discovered.bins.map((b) => b.id)
        if (binIds.length === 0) {
          throw new SectorOneError(
            'NO_LP_FOUND',
            'No LP bins found for wallet. Pass --bin-ids or deposit liquidity first.'
          )
        }
      }

      const balances = await fetchUserLiquidityBalances({
        client,
        version,
        pair: resolved.pairAddress,
        wallet,
        binIds
      })
      const liquidityAmounts = scaleLiquidityBalances(balances, 1)

      const remove = await buildRemoveLiquidityBatches({
        client,
        wallet,
        version,
        pair: resolved.pairAddress,
        tokenX,
        tokenY,
        binStep,
        binIds,
        liquidityAmounts,
        amountSlippageBps,
        ttl,
        batchSize
      })

      const add = await buildAddLiquidityCalls({
        client,
        wallet,
        tokenX,
        tokenY,
        amountX: opts.amountX,
        amountY: opts.amountY,
        tokenXDecimals: tokenX.decimals,
        tokenYDecimals: tokenY.decimals,
        binStep,
        version,
        amountSlippageBps,
        priceSlippageBps,
        distribution,
        ttl,
        binCount,
        infiniteApproval: Boolean(opts.infiniteApproval)
      })

      const payload = {
        chain: 'base' as const,
        summary: {
          protocol: 'SectorOne DLMM',
          chainId: 8453,
          action: 'rebalanceLiquidity',
          pair: resolved.pairAddress,
          activeId: remove.activeId,
          binStep,
          removeBinIds: binIds,
          removeBatchCount: remove.batches.length,
          addDistribution: opts.distribution,
          addBinCount: add.binCount,
          addBinRange: add.binRange,
          needsWethWrap: add.needsWethWrap,
          router: getAddress(remove.router)
        },
        steps: [
          ...remove.batches.map((batch) => ({
            action: 'removeLiquidity' as const,
            batchIndex: batch.batchIndex,
            binIds: batch.binIds,
            calls: batch.calls
          })),
          {
            action: 'addLiquidity' as const,
            calls: add.calls
          }
        ]
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `Rebalance: ${remove.batches.length} remove batch(es) + 1 add.`,
        `Pair: ${resolved.pairAddress}`,
        `New shape: ${opts.distribution} × ${add.binCount} bins`
      ])
    })
}
