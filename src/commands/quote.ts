import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { parseTokenAmount } from '../lib/amounts.js'
import {
  formatQuoteOutput,
  quoteExactInput
} from '../lib/dlmm.js'
import { makeToken, parseBaseTokenArg } from '../lib/tokens.js'
import {
  assertSlippageSafe,
  parseAddress,
  parseDecimals,
  parseSlippageBps
} from '../lib/validation.js'
import { writeJson, writeHuman, writeWarning } from '../lib/output.js'
import { collectStrings } from '../lib/cli-parse.js'

export function registerQuote(program: Command): void {
  program
    .command('quote')
    .description('Quote exact-input DLMM swap')
    .requiredOption('--token-in <address>')
    .requiredOption('--token-out <address>')
    .requiredOption('--token-in-decimals <n>', 'Input token decimals')
    .requiredOption('--token-out-decimals <n>', 'Output token decimals')
    .requiredOption('--amount-in <amount>')
    .option('--slippage-bps <n>', 'Slippage in basis points', '50')
    .option('--recipient <address>', 'Swap recipient', '0x0000000000000000000000000000000000000000')
    .option('--native-in', 'Input is native ETH')
    .option('--native-out', 'Output is native ETH')
    .option('--base-token <address[:decimals]>', 'Extra routing base token, decimals default 18 (repeatable)', collectStrings, [])
    .option('--max-hops <n>', 'Max hops', '3')
    .option('--ttl <n>', 'Deadline TTL seconds', '1200')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const slippageBps = parseSlippageBps(Number(opts.slippageBps))
      const level = assertSlippageSafe(slippageBps)
      if (level !== 'normal') {
        writeWarning(
          `Slippage ${slippageBps} bps is ${level}. Confirm with the user before submitting.`
        )
      }

      const tokenIn = makeToken({
        address: opts.tokenIn,
        decimals: parseDecimals(Number(opts.tokenInDecimals), 'token-in-decimals')
      })
      const tokenOut = makeToken({
        address: opts.tokenOut,
        decimals: parseDecimals(Number(opts.tokenOutDecimals), 'token-out-decimals')
      })

      const baseTokens = (opts.baseToken as string[]).map(parseBaseTokenArg)

      const client = createBasePublicClient()
      const amountInRaw = parseTokenAmount(opts.amountIn, tokenIn.decimals)

      const { trade, router, swapParams } = await quoteExactInput({
        client,
        tokenIn,
        tokenOut,
        amountIn: opts.amountIn,
        tokenInDecimals: tokenIn.decimals,
        slippageBps,
        recipient: parseAddress(opts.recipient, 'recipient'),
        isNativeIn: Boolean(opts.nativeIn),
        isNativeOut: Boolean(opts.nativeOut),
        baseTokens: baseTokens.length ? baseTokens : undefined,
        maxHops: Number(opts.maxHops),
        ttl: Number(opts.ttl)
      })

      const payload = formatQuoteOutput({
        trade,
        router,
        swapParams,
        slippageBps,
        tokenIn,
        tokenOut,
        amountInRaw
      })

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `Expected out: ${payload.expectedOutFormatted}`,
        `Price impact: ${payload.priceImpactPercent}%`,
        `Router: ${getAddress(router)}`,
        `Method: ${payload.swap.methodName}`
      ])
    })
}
