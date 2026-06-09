import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { discoverLpBins } from '../lib/dlmm.js'
import { parseAddress, parseLbVersion } from '../lib/validation.js'
import { parseBinCount } from '../lib/bin-range.js'
import { writeJson, writeHuman } from '../lib/output.js'

export function registerDiscoverLpBins(program: Command): void {
  program
    .command('discover-lp-bins')
    .description('Find LB bin IDs where a wallet holds LP shares (scan around active bin)')
    .requiredOption('--wallet <address>')
    .requiredOption('--pair <address>')
    .option('--lb-version <v>', 'LB version: v2 or v22', 'v2')
    .option('--scan-bins <n>', 'Bins to scan centered on activeId', '60')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const wallet = parseAddress(opts.wallet, 'wallet')
      const pair = parseAddress(opts.pair, 'pair')
      const version = parseLbVersion(opts.lbVersion)
      const scanBins = parseBinCount(Number(opts.scanBins))

      const client = createBasePublicClient()
      const result = await discoverLpBins({
        client,
        wallet,
        pair,
        version,
        scanBins
      })

      const payload = {
        chainId: 8453,
        wallet: getAddress(wallet),
        pair: getAddress(pair),
        version,
        activeId: result.activeId,
        scanRange: result.scanRange,
        binIds: result.bins.map((b) => b.id),
        bins: result.bins,
        suggestedRemoveBatchSize: result.suggestedRemoveBatchSize
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `Active bin: ${result.activeId}`,
        `LP bins (${result.bins.length}): ${payload.binIds.join(', ') || '(none)'}`,
        `Suggested remove batch size: ${result.suggestedRemoveBatchSize}`
      ])
    })
}
