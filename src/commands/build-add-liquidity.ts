import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { buildAddLiquidityCalls, parseDistribution } from '../lib/dlmm.js'
import { makeToken } from '../lib/tokens.js'
import {
  assertBaseChainOnly,
  assertSlippageSafe,
  parseAddress,
  parseBinStep,
  parseDecimals,
  parseLbVersion,
  parseSlippageBps,
  parseTtlSeconds
} from '../lib/validation.js'
import { assertInfiniteApprovalConfirmed } from '../lib/safety.js'
import { writeJson, writeHuman, writeWarning } from '../lib/output.js'

export function registerBuildAddLiquidity(program: Command): void {
  program
    .command('build-add-liquidity')
    .description('Build Base MCP send_calls for DLMM add liquidity')
    .requiredOption('--wallet <address>')
    .requiredOption('--token-x <address>')
    .requiredOption('--token-y <address>')
    .requiredOption('--token-x-decimals <n>', 'Token X decimals')
    .requiredOption('--token-y-decimals <n>', 'Token Y decimals')
    .requiredOption('--amount-x <amount>')
    .requiredOption('--amount-y <amount>')
    .requiredOption('--bin-step <n>', 'Pair bin step')
    .option('--lb-version <v>', 'LB version: v2 (Joe 2.0) or v22', 'v2')
    .option('--distribution <name>', 'SPOT | CURVE | BID_ASK', 'SPOT')
    .option('--amount-slippage-bps <n>', 'Amount slippage bps', '50')
    .option('--price-slippage-bps <n>', 'Price slippage bps', '50')
    .option('--ttl <n>', 'Deadline TTL seconds', '1200')
    .option('--native-x', 'Token X is native ETH (WETH side)')
    .option('--native-y', 'Token Y is native ETH (WETH side)')
    .option('--infinite-approval', 'Infinite ERC-20 approvals')
    .option('--confirm-infinite-approval', 'Required second confirmation for --infinite-approval')
    .option('--confirm-high-slippage', 'Allow very high (>20%) slippage after explicit user confirmation')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      assertBaseChainOnly()
      assertInfiniteApprovalConfirmed(
        Boolean(opts.infiniteApproval),
        Boolean(opts.confirmInfiniteApproval)
      )
      const version = parseLbVersion(opts.lbVersion)
      const binStep = parseBinStep(Number(opts.binStep))
      const amountSlippageBps = parseSlippageBps(Number(opts.amountSlippageBps))
      const priceSlippageBps = parseSlippageBps(Number(opts.priceSlippageBps))
      const ttl = parseTtlSeconds(Number(opts.ttl))

      for (const bps of [amountSlippageBps, priceSlippageBps]) {
        const level = assertSlippageSafe(bps, !opts.confirmHighSlippage)
        if (level !== 'normal') {
          writeWarning(`Slippage ${bps} bps is ${level}.`)
        }
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
      const { calls, router, pairAddress, activeId } = await buildAddLiquidityCalls({
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
        distribution: parseDistribution(opts.distribution),
        ttl,
        nativeX: Boolean(opts.nativeX),
        nativeY: Boolean(opts.nativeY),
        infiniteApproval: Boolean(opts.infiniteApproval)
      })

      const payload = {
        chain: 'base' as const,
        summary: {
          protocol: 'SectorOne DLMM',
          chainId: 8453,
          action: 'addLiquidity',
          pair: pairAddress,
          activeId,
          binStep,
          tokenX: getAddress(tokenX.address),
          tokenY: getAddress(tokenY.address),
          distribution: opts.distribution,
          router: getAddress(router),
          approvalType: opts.infiniteApproval ? 'infinite' : 'exact',
          ...(opts.infiniteApproval
            ? { approvalRisk: 'unlimited allowance granted to router' }
            : {})
        },
        calls
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `Built ${calls.length} call(s) for add liquidity.`,
        `Pair: ${pairAddress}`,
        `Active bin: ${activeId}`
      ])
    })
}
