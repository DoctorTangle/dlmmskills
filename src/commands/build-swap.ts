import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { parseTokenAmount } from '../lib/amounts.js'
import {
  assembleSwapCalls,
  formatQuoteOutput,
  quoteExactInput
} from '../lib/dlmm.js'
import { makeToken, parseBaseTokenArg } from '../lib/tokens.js'
import {
  assertBaseChainOnly,
  assertSlippageSafe,
  parseAddress,
  parseDecimals,
  parseSlippageBps,
  parseTtlSeconds
} from '../lib/validation.js'
import { assertNativeIsWeth, assertInfiniteApprovalConfirmed } from '../lib/safety.js'
import { writeJson, writeHuman, writeWarning } from '../lib/output.js'
import { collectStrings } from '../lib/cli-parse.js'

export function registerBuildSwap(program: Command): void {
  program
    .command('build-swap')
    .description('Build Base MCP send_calls payload for a DLMM swap')
    .requiredOption('--wallet <address>')
    .requiredOption('--token-in <address>')
    .requiredOption('--token-out <address>')
    .requiredOption('--token-in-decimals <n>', 'Input token decimals')
    .requiredOption('--token-out-decimals <n>', 'Output token decimals')
    .requiredOption('--amount-in <amount>')
    .option('--slippage-bps <n>', 'Slippage in basis points', '50')
    .option('--ttl <n>', 'Deadline TTL seconds', '1200')
    .option('--native-in', 'Input is native ETH')
    .option('--native-out', 'Output is native ETH')
    .option('--base-token <address[:decimals]>', 'Routing base token, decimals default 18 (repeatable)', collectStrings, [])
    .option('--infinite-approval', 'Use infinite ERC-20 approval')
    .option('--confirm-infinite-approval', 'Required second confirmation for --infinite-approval')
    .option('--confirm-high-slippage', 'Allow very high (>20%) slippage after explicit user confirmation')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      assertBaseChainOnly()
      assertInfiniteApprovalConfirmed(
        Boolean(opts.infiniteApproval),
        Boolean(opts.confirmInfiniteApproval)
      )
      const slippageBps = parseSlippageBps(Number(opts.slippageBps))
      const ttl = parseTtlSeconds(Number(opts.ttl))
      const level = assertSlippageSafe(slippageBps, !opts.confirmHighSlippage)
      if (level !== 'normal') {
        writeWarning(
          `Slippage ${slippageBps} bps is ${level}. Confirm with the user before send_calls.`
        )
      }

      const wallet = parseAddress(opts.wallet, 'wallet')
      const tokenIn = makeToken({
        address: opts.tokenIn,
        decimals: parseDecimals(Number(opts.tokenInDecimals), 'token-in-decimals')
      })
      const tokenOut = makeToken({
        address: opts.tokenOut,
        decimals: parseDecimals(Number(opts.tokenOutDecimals), 'token-out-decimals')
      })

      assertNativeIsWeth(Boolean(opts.nativeIn), tokenIn.address, '--native-in')
      assertNativeIsWeth(Boolean(opts.nativeOut), tokenOut.address, '--native-out')

      const baseTokens = (opts.baseToken as string[]).map(parseBaseTokenArg)

      const client = createBasePublicClient()
      const amountInRaw = parseTokenAmount(opts.amountIn, tokenIn.decimals)

      const quoted = await quoteExactInput({
        client,
        tokenIn,
        tokenOut,
        amountIn: opts.amountIn,
        tokenInDecimals: tokenIn.decimals,
        slippageBps,
        recipient: wallet,
        isNativeIn: Boolean(opts.nativeIn),
        isNativeOut: Boolean(opts.nativeOut),
        baseTokens: baseTokens.length ? baseTokens : undefined,
        ttl
      })

      const { trade, router, version, swapParams } = quoted

      if (version === 'v2') {
        writeWarning(
          'Route uses LB v2.0 (Joe 2.0) pools — router 0xd4f937581650A2d6e416Dd9EF5372C1672422843.'
        )
      }

      const calls = await assembleSwapCalls({
        client,
        wallet,
        trade,
        router,
        version,
        swapParams,
        tokenIn,
        amountInRaw,
        infiniteApproval: Boolean(opts.infiniteApproval)
      })

      const quote = formatQuoteOutput({
        trade,
        router,
        swapParams,
        slippageBps,
        tokenIn,
        tokenOut,
        amountInRaw
      })

      const payload = {
        chain: 'base' as const,
        summary: {
          protocol: 'SectorOne DLMM',
          chainId: 8453,
          action: 'swapExactInput',
          tokenIn: getAddress(tokenIn.address),
          tokenOut: getAddress(tokenOut.address),
          amountInRaw: amountInRaw.toString(),
          expectedOutRaw: quote.expectedOutRaw,
          expectedOutFormatted: quote.expectedOutFormatted,
          allowedSlippageBps: slippageBps,
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
        `Built ${calls.length} call(s) for Base MCP send_calls.`,
        `Router: ${router}`,
        `Expected out: ${quote.expectedOutFormatted}`
      ])
    })
}
