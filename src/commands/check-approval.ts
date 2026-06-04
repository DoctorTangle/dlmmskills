import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { buildApprovalIfNeeded } from '../lib/approvals.js'
import { parseAddress } from '../lib/validation.js'
import { assertInfiniteApprovalConfirmed } from '../lib/safety.js'
import { SectorOneError } from '../lib/errors.js'
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
    .option('--confirm-infinite-approval', 'Required second confirmation for --infinite')
    .option('--native', 'Input token is native ETH (no ERC-20 approval)')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      assertInfiniteApprovalConfirmed(
        Boolean(opts.infinite),
        Boolean(opts.confirmInfiniteApproval)
      )
      const wallet = parseAddress(opts.wallet, 'wallet')
      const token = parseAddress(opts.token, 'token')
      const spender = parseAddress(opts.spender, 'spender')
      let amountRaw: bigint
      try {
        amountRaw = BigInt(opts.amountRaw)
      } catch {
        throw new SectorOneError('INVALID_AMOUNT', `amount-raw is not a valid integer: ${opts.amountRaw}`)
      }
      if (amountRaw <= 0n) {
        throw new SectorOneError('INVALID_AMOUNT', 'amount-raw must be a positive integer.')
      }

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
        approvalType: opts.infinite ? 'infinite' : 'exact',
        ...(opts.infinite ? { approvalRisk: 'unlimited allowance granted to spender' } : {}),
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
