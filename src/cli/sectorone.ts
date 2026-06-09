#!/usr/bin/env node
import 'dotenv/config'
import { Command } from 'commander'
import { registerListPairs } from '../commands/list-pairs.js'
import { registerReadPool } from '../commands/read-pool.js'
import { registerReadBinPrice } from '../commands/read-bin-price.js'
import { registerQuote } from '../commands/quote.js'
import { registerCheckApproval } from '../commands/check-approval.js'
import { registerBuildSwap } from '../commands/build-swap.js'
import { registerBuildAddLiquidity } from '../commands/build-add-liquidity.js'
import { registerBuildRemoveLiquidity } from '../commands/build-remove-liquidity.js'
import { registerBuildCreatePool } from '../commands/build-create-pool.js'
import { registerReadPosition } from '../commands/read-position.js'
import { registerBuildRebalanceLiquidity } from '../commands/build-rebalance-liquidity.js'
import { registerDiscoverLpBins } from '../commands/discover-lp-bins.js'
import { registerCheckLpApproval } from '../commands/check-lp-approval.js'
import { registerWalletBalances } from '../commands/wallet-balances.js'
import { registerNormalizeCalls } from '../commands/normalize-calls.js'
import { isSectorOneError } from '../lib/errors.js'
import { exitWithError, writeError } from '../lib/output.js'

const program = new Command()

program
  .name('sectorone')
  .description('SectorOne DLMM CLI for Base MCP (unsigned calldata only)')
  .version('1.0.0')

registerListPairs(program)
registerReadPool(program)
registerReadBinPrice(program)
registerQuote(program)
registerCheckApproval(program)
registerBuildSwap(program)
registerBuildAddLiquidity(program)
registerBuildRemoveLiquidity(program)
registerBuildCreatePool(program)
registerReadPosition(program)
registerDiscoverLpBins(program)
registerCheckLpApproval(program)
registerWalletBalances(program)
registerBuildRebalanceLiquidity(program)
registerNormalizeCalls(program)

program.exitOverride()

try {
  await program.parseAsync(process.argv)
} catch (err) {
  if (isSectorOneError(err)) {
    exitWithError(`${err.code}: ${err.message}`)
  }
  const commanderErr = err as { code?: string; message?: string }
  if (commanderErr.code === 'commander.helpDisplayed') {
    process.exit(0)
  }
  if (commanderErr.code === 'commander.version') {
    process.exit(0)
  }
  if (commanderErr.code === 'commander.missingMandatoryOptionValue') {
    exitWithError(commanderErr.message ?? 'Missing required option.')
  }
  writeError(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
