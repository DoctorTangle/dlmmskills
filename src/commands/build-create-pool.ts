import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { resolveCreatePoolActiveId } from '../lib/create-pool-price.js'
import { buildCreatePoolCalls } from '../lib/dlmm.js'
import { makeToken } from '../lib/tokens.js'
import {
  assertBaseChainOnly,
  parseActiveBinId,
  parseBinStep,
  parseDecimals,
  parseLbVersion
} from '../lib/validation.js'
import { SectorOneError } from '../lib/errors.js'
import { writeJson, writeHuman } from '../lib/output.js'

export function registerBuildCreatePool(program: Command): void {
  program
    .command('build-create-pool')
    .description(
      'Build Base MCP send_calls to deploy a new SectorOne DLMM LB pair (router createLBPair)'
    )
    .requiredOption('--token-x <address>')
    .requiredOption('--token-y <address>')
    .requiredOption('--token-x-decimals <n>', 'Token X decimals')
    .requiredOption('--token-y-decimals <n>', 'Token Y decimals')
    .requiredOption('--bin-step <n>', 'Pair bin step (must have a factory preset)')
    .option('--lb-version <v>', 'LB version: v2 (Joe 2.0) or v22', 'v2')
    .option('--active-id <n>', 'Initial active bin id (uint24; on-chain sorted token order)')
    .option(
      '--price-token-y-per-token-x <n>',
      'Price as your CLI --token-y per --token-x (converted to sorted order for bin math)'
    )
    .option(
      '--price-sorted-y-per-sorted-x <n>',
      'Price as on-chain token1 per token0; requires --token-x to be the lower-address token'
    )
    .option(
      '--confirm-create',
      'Required: explicit confirmation that the user wants to deploy a new pool'
    )
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      assertBaseChainOnly()

      if (!opts.confirmCreate) {
        throw new SectorOneError(
          'CONFIRM_CREATE_REQUIRED',
          'Pool creation deploys a new on-chain market. Pass --confirm-create after the user explicitly agrees.'
        )
      }

      const version = parseLbVersion(opts.lbVersion)
      const binStep = parseBinStep(Number(opts.binStep))

      const tokenX = makeToken({
        address: opts.tokenX,
        decimals: parseDecimals(Number(opts.tokenXDecimals), 'token-x-decimals')
      })
      const tokenY = makeToken({
        address: opts.tokenY,
        decimals: parseDecimals(Number(opts.tokenYDecimals), 'token-y-decimals')
      })

      const resolved = resolveCreatePoolActiveId({
        tokenX,
        tokenY,
        binStep,
        activeId:
          opts.activeId !== undefined
            ? parseActiveBinId(Number(opts.activeId))
            : undefined,
        priceInputYPerInputX:
          opts.priceTokenYPerTokenX !== undefined
            ? Number(opts.priceTokenYPerTokenX)
            : undefined,
        priceSortedYPerSortedX:
          opts.priceSortedYPerSortedX !== undefined
            ? Number(opts.priceSortedYPerSortedX)
            : undefined
      })

      // Price/order validation runs before RPC so agents get deterministic errors.
      const client = createBasePublicClient()
      const {
        calls,
        router,
        tokenX: sortedX,
        tokenY: sortedY,
        activeId: activeIdUsed,
        binStep: binStepUsed
      } = await buildCreatePoolCalls({
        client,
        version,
        tokenX,
        tokenY,
        binStep,
        activeId: resolved.activeId
      })

      const payload = {
        chain: 'base' as const,
        summary: {
          protocol: 'SectorOne DLMM',
          chainId: 8453,
          action: 'createLBPair',
          lbVersion: version,
          inputTokenX: resolved.inputTokenX,
          inputTokenY: resolved.inputTokenY,
          sortedTokenX: getAddress(sortedX),
          sortedTokenY: getAddress(sortedY),
          inputOrderWasSorted: resolved.inputOrderWasSorted,
          priceMode: resolved.priceMode,
          priceSemantic: resolved.priceSemantic,
          priceUsedForBinMath: resolved.priceUsedForBinMath,
          impliedSortedYPerSortedX: resolved.impliedSortedYPerSortedX,
          binStep: binStepUsed,
          activeId: activeIdUsed,
          router: getAddress(router)
        },
        calls
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `Built ${calls.length} call(s) to create a new LB pair.`,
        `Input tokens: ${resolved.inputTokenX} / ${resolved.inputTokenY}`,
        `Sorted (router): ${sortedX} / ${sortedY}`,
        `inputOrderWasSorted=${resolved.inputOrderWasSorted} priceMode=${resolved.priceMode}`,
        `activeId=${activeIdUsed} impliedSortedYPerSortedX≈${resolved.impliedSortedYPerSortedX}`,
        `Router: ${router}`
      ])
    })
}
