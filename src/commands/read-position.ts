import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { readPositionAmounts } from '../lib/dlmm.js'
import { makeToken } from '../lib/tokens.js'
import { parseAddress, parseBinIds, parseDecimals } from '../lib/validation.js'
import { writeJson, writeHuman } from '../lib/output.js'

export function registerReadPosition(program: Command): void {
  program
    .command('read-position')
    .description('Read LP token amounts across bin IDs via LiquidityHelper')
    .requiredOption('--wallet <address>')
    .requiredOption('--pair <address>')
    .requiredOption('--bin-ids <ids>', 'Comma-separated bin IDs')
    .option('--token-x <address>')
    .option('--token-y <address>')
    .option('--token-x-decimals <n>', 'Token X decimals')
    .option('--token-y-decimals <n>', 'Token Y decimals')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const wallet = parseAddress(opts.wallet, 'wallet')
      const pair = parseAddress(opts.pair, 'pair')
      const binIds = parseBinIds(opts.binIds)

      const tokenX =
        opts.tokenX && opts.tokenXDecimals
          ? makeToken({
              address: opts.tokenX,
              decimals: parseDecimals(Number(opts.tokenXDecimals), 'token-x-decimals')
            })
          : undefined
      const tokenY =
        opts.tokenY && opts.tokenYDecimals
          ? makeToken({
              address: opts.tokenY,
              decimals: parseDecimals(Number(opts.tokenYDecimals), 'token-y-decimals')
            })
          : undefined

      const client = createBasePublicClient()
      const result = await readPositionAmounts({
        client,
        wallet,
        pair,
        binIds,
        tokenX,
        tokenY
      })

      const payload = {
        chainId: 8453,
        pair: getAddress(pair),
        wallet: getAddress(wallet),
        binIds,
        amountsX: result.amountsX.map((a) => a.toString()),
        amountsY: result.amountsY.map((a) => a.toString()),
        ...(result.formatted ? { formatted: result.formatted } : {})
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman(
        binIds.map((id, i) => {
          const x = result.formatted?.amountsX[i] ?? result.amountsX[i]?.toString()
          const y = result.formatted?.amountsY[i] ?? result.amountsY[i]?.toString()
          return `Bin ${id}: X=${x} Y=${y}`
        })
      )
    })
}
