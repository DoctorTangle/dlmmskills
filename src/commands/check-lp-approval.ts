import { getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { checkLpRouterApproval } from '../lib/dlmm.js'
import { parseAddress, parseLbVersion } from '../lib/validation.js'
import { writeJson, writeHuman } from '../lib/output.js'

export function registerCheckLpApproval(program: Command): void {
  program
    .command('check-lp-approval')
    .description('Check ERC-1155 setApprovalForAll on LB pair for the SectorOne router')
    .requiredOption('--wallet <address>')
    .requiredOption('--pair <address>')
    .option('--lb-version <v>', 'LB version: v2 or v22', 'v2')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const wallet = parseAddress(opts.wallet, 'wallet')
      const pair = parseAddress(opts.pair, 'pair')
      const version = parseLbVersion(opts.lbVersion)

      const client = createBasePublicClient()
      const { router, approved } = await checkLpRouterApproval({
        client,
        wallet,
        pair,
        version
      })

      const payload = {
        chainId: 8453,
        wallet: getAddress(wallet),
        pair: getAddress(pair),
        router: getAddress(router),
        approved,
        approvalNeeded: !approved,
        note: approved
          ? 'Router already approved for all LP bins on this pair.'
          : 'build-remove-liquidity emits setApprovalForAll before removeLiquidity when needed.'
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        approved
          ? `LP router approval OK (${router}).`
          : `LP router approval needed — setApprovalForAll(${router}, true) on pair ${pair}.`
      ])
    })
}
