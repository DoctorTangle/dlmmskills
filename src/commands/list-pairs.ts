import { ChainId } from '@sectorone/sdk-core'
import { PairV2 } from '@sectorone/sdk-v2'
import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { makeToken } from '../lib/tokens.js'
import { parseDecimals, parseLbVersion } from '../lib/validation.js'
import { writeJson, writeHuman } from '../lib/output.js'

export function registerListPairs(program: Command): void {
  program
    .command('list-pairs')
    .description('List SectorOne LB pairs for a token pair')
    .requiredOption('--token-in <address>')
    .requiredOption('--token-out <address>')
    .requiredOption('--token-in-decimals <n>', 'Input token decimals')
    .requiredOption('--token-out-decimals <n>', 'Output token decimals')
    .option('--lb-version <v>', 'LB version: v2 (Joe 2.0) or v22', 'v2')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const version = parseLbVersion(opts.lbVersion)
      const tokenIn = makeToken({
        address: opts.tokenIn,
        decimals: parseDecimals(Number(opts.tokenInDecimals), 'token-in-decimals')
      })
      const tokenOut = makeToken({
        address: opts.tokenOut,
        decimals: parseDecimals(Number(opts.tokenOutDecimals), 'token-out-decimals')
      })

      const client = createBasePublicClient()
      const pair = new PairV2(tokenIn, tokenOut)
      const pairs = await pair.fetchAvailableLBPairs(version, client, ChainId.BASE)

      const payload = {
        chainId: 8453,
        version,
        tokenIn: getAddress(opts.tokenIn),
        tokenOut: getAddress(opts.tokenOut),
        pairs: pairs.map((p) => ({
          pair: getAddress(p.LBPair),
          binStep: p.binStep
        }))
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `SectorOne LB pairs (${version}) on Base:`,
        ...payload.pairs.map(
          (p) => `  ${p.pair}  binStep=${p.binStep}`
        )
      ])
    })
}
