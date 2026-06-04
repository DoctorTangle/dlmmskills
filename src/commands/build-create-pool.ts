import { Bin } from '@sectorone/sdk-v2'
import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { buildCreatePoolCalls } from '../lib/dlmm.js'
import { makeToken } from '../lib/tokens.js'
import {
  assertBaseChainOnly,
  DEFAULT_ACTIVE_BIN_ID,
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
    .option(
      '--active-id <n>',
      `Initial active bin id (default ${DEFAULT_ACTIVE_BIN_ID} if --price omitted)`
    )
    .option('--price <n>', 'Initial price (token Y per token X); converts to active bin id')
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

      const hasActiveId = opts.activeId !== undefined
      const hasPrice = opts.price !== undefined
      if (hasActiveId && hasPrice) {
        throw new SectorOneError(
          'ACTIVE_ID_OR_PRICE',
          'Provide only one of --active-id or --price, not both.'
        )
      }

      const version = parseLbVersion(opts.lbVersion)
      const binStep = parseBinStep(Number(opts.binStep))

      let activeId: number
      if (hasPrice) {
        const price = Number(opts.price)
        if (!Number.isFinite(price) || price <= 0) {
          throw new SectorOneError(
            'INVALID_PRICE',
            '--price must be a positive number (token Y per token X).'
          )
        }
        activeId = Bin.getIdFromPrice(price, binStep)
      } else if (hasActiveId) {
        activeId = parseActiveBinId(Number(opts.activeId))
      } else {
        activeId = DEFAULT_ACTIVE_BIN_ID
      }

      const tokenX = makeToken({
        address: opts.tokenX,
        decimals: parseDecimals(Number(opts.tokenXDecimals), 'token-x-decimals')
      })
      const tokenY = makeToken({
        address: opts.tokenY,
        decimals: parseDecimals(Number(opts.tokenYDecimals), 'token-y-decimals')
      })

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
        activeId
      })

      const payload = {
        chain: 'base' as const,
        summary: {
          protocol: 'SectorOne DLMM',
          chainId: 8453,
          action: 'createLBPair',
          lbVersion: version,
          tokenX: getAddress(sortedX),
          tokenY: getAddress(sortedY),
          binStep: binStepUsed,
          activeId: activeIdUsed,
          initialPrice: Bin.getPriceFromId(activeIdUsed, binStepUsed),
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
        `Tokens (sorted): ${sortedX} / ${sortedY}`,
        `binStep=${binStepUsed} activeId=${activeIdUsed} (~price ${payload.summary.initialPrice})`,
        `Router: ${router}`
      ])
    })
}
