import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import {
  buildRemoveLiquidityCalls,
  fetchUserLiquidityBalances,
  resolveLbPair,
  scaleLiquidityBalances
} from '../lib/dlmm.js'
import { makeToken } from '../lib/tokens.js'
import {
  assertBaseChainOnly,
  assertSlippageSafe,
  parseAddress,
  parseBinIds,
  parseBinStep,
  parseDecimals,
  parseFraction,
  parseLbVersion,
  parseLiquidityAmountsList,
  parseSlippageBps,
  parseTtlSeconds
} from '../lib/validation.js'
import { assertNativeIsWeth } from '../lib/safety.js'
import { writeJson, writeHuman, writeWarning } from '../lib/output.js'
import { SectorOneError } from '../lib/errors.js'

export function registerBuildRemoveLiquidity(program: Command): void {
  program
    .command('build-remove-liquidity')
    .description('Build Base MCP send_calls for DLMM remove liquidity')
    .requiredOption('--wallet <address>')
    .requiredOption('--bin-ids <ids>', 'Comma-separated bin IDs to remove from')
    .requiredOption('--token-x <address>')
    .requiredOption('--token-y <address>')
    .requiredOption('--token-x-decimals <n>', 'Token X decimals')
    .requiredOption('--token-y-decimals <n>', 'Token Y decimals')
    .requiredOption('--bin-step <n>', 'Pair bin step')
    .option('--pair <address>', 'LB pair address (optional if tokens + bin-step resolve it)')
    .option('--lb-version <v>', 'LB version: v2 (Joe 2.0) or v22', 'v2')
    .option(
      '--amounts <list>',
      'Comma-separated LP share amounts to burn per bin (base units, same order as --bin-ids)'
    )
    .option('--fraction <n>', 'Fraction of your LP shares per bin to remove (0 < n <= 1)')
    .option('--remove-all', 'Remove 100% of LP shares in each listed bin')
    .option('--amount-slippage-bps <n>', 'Output amount slippage bps', '50')
    .option('--ttl <n>', 'Deadline TTL seconds', '1200')
    .option('--native-x', 'Receive native ETH for the WETH (token X) side')
    .option('--native-y', 'Receive native ETH for the WETH (token Y) side')
    .option('--confirm-high-slippage', 'Allow very high (>20%) slippage after explicit user confirmation')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      assertBaseChainOnly()

      const modeCount = [opts.amounts, opts.fraction, opts.removeAll].filter(Boolean)
        .length
      if (modeCount !== 1) {
        throw new SectorOneError(
          'REMOVE_MODE_REQUIRED',
          'Specify exactly one of --amounts, --fraction, or --remove-all.'
        )
      }

      const version = parseLbVersion(opts.lbVersion)
      const binStep = parseBinStep(Number(opts.binStep))
      const binIds = parseBinIds(opts.binIds)
      const amountSlippageBps = parseSlippageBps(Number(opts.amountSlippageBps))
      const ttl = parseTtlSeconds(Number(opts.ttl))

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

      assertNativeIsWeth(Boolean(opts.nativeX), tokenX.address, '--native-x')
      assertNativeIsWeth(Boolean(opts.nativeY), tokenY.address, '--native-y')

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

      let liquidityAmounts: bigint[]

      if (opts.amounts) {
        liquidityAmounts = parseLiquidityAmountsList(opts.amounts, binIds.length)
      } else {
        const balances = await fetchUserLiquidityBalances({
          client,
          version,
          pair: resolved.pairAddress,
          wallet,
          binIds
        })

        for (let i = 0; i < balances.length; i++) {
          if (balances[i]! <= 0n) {
            throw new SectorOneError(
              'NO_LP_IN_BIN',
              `Wallet has no LP shares in bin ${binIds[i]}. Run read-position or adjust --bin-ids.`
            )
          }
        }

        const fraction = opts.removeAll ? 1 : parseFraction(Number(opts.fraction))
        liquidityAmounts = scaleLiquidityBalances(balances, fraction)

        for (let i = 0; i < liquidityAmounts.length; i++) {
          if (liquidityAmounts[i]! <= 0n) {
            throw new SectorOneError(
              'ZERO_LIQUIDITY',
              `Scaled remove amount for bin ${binIds[i]} is zero. Use a larger --fraction or --amounts.`
            )
          }
        }
      }

      const {
        calls,
        router,
        pairAddress,
        activeId,
        amountXMin,
        amountYMin,
        liquidityAmounts: liquidityUsed
      } = await buildRemoveLiquidityCalls({
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
        nativeX: Boolean(opts.nativeX),
        nativeY: Boolean(opts.nativeY)
      })

      const payload = {
        chain: 'base' as const,
        summary: {
          protocol: 'SectorOne DLMM',
          chainId: 8453,
          action: 'removeLiquidity',
          pair: pairAddress,
          activeId,
          binStep,
          binIds,
          liquidityAmounts: liquidityUsed,
          amountXMin: amountXMin.toString(),
          amountYMin: amountYMin.toString(),
          tokenX: getAddress(tokenX.address),
          tokenY: getAddress(tokenY.address),
          router: getAddress(router),
          receiveNative: Boolean(opts.nativeX || opts.nativeY)
        },
        calls
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `Built ${calls.length} call(s) for remove liquidity.`,
        `Pair: ${pairAddress}`,
        `Bins: ${binIds.join(', ')}`
      ])
    })
}
