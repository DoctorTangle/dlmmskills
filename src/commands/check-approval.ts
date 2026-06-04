import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { buildApprovalIfNeeded } from '../lib/approvals.js'
import { parseAddress } from '../lib/validation.js'
import { writeJson, writeHuman } from '../lib/output.js'
import { getAddress } from 'viem'

export function registerCheckApproval(program: Command): void {
  program
    .command('check-approval')
    .description('Build ERC-20 approval calldata when allowance is insufficient')
    .requiredOption('--wallet <address>')
    .requiredOption('--token <address>')
    .requiredOption('--spender <address>')
    .requiredOption('--amount-raw <amount>')
    .option('--infinite', 'Use max uint256 approval')
    .option('--native', 'Input token is native ETH (no ERC-20 approval)')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const wallet = parseAddress(opts.wallet, 'wallet')
      const token = parseAddress(opts.token, 'token')
      const spender = parseAddress(opts.spender, 'spender')
      const amountRaw = BigInt(opts.amountRaw)

      if (Boolean(opts.native)) {
        const payload = {
          approvalNeeded: false,
          reason: 'Native ETH does not require ERC-20 approval'
        }
        if (opts.json) {
          writeJson(payload)
          return
        }
        writeHuman(['Approval not needed for native ETH.'])
        return
      }

      const client = createBasePublicClient()
      const result = await buildApprovalIfNeeded({
        client,
        wallet,
        token,
        spender,
        amount: amountRaw,
        infinite: Boolean(opts.infinite)
      })

      const payload = {
        approvalNeeded: result.approvalNeeded,
        token: getAddress(token),
        spender: getAddress(spender),
        amountRaw: amountRaw.toString(),
        ...(result.call ? { call: result.call } : {})
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        result.approvalNeeded
          ? `Approval needed for ${token}`
          : 'Sufficient allowance; no approval call required.'
      ])
    })
}
