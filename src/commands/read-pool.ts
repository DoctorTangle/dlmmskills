import { ChainId } from '@sectorone/sdk-core'
import { PairV2 } from '@sectorone/sdk-v2'
import { formatUnits, getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { makeToken } from '../lib/tokens.js'
import { parseBinStep, parseDecimals, parseLbVersion } from '../lib/validation.js'
import { writeJson, writeHuman } from '../lib/output.js'
import { SectorOneError } from '../lib/errors.js'

export function registerReadPool(program: Command): void {
  program
    .command('read-pool')
    .description('Read active bin and reserves for an LB pair')
    .option('--pair <address>', 'LB pair address')
    .option('--token-x <address>')
    .option('--token-y <address>')
    .option('--token-x-decimals <n>', 'Token X decimals')
    .option('--token-y-decimals <n>', 'Token Y decimals')
    .option('--bin-step <n>', 'Pair bin step')
    .option('--lb-version <v>', 'LB version: v2 (Joe 2.0) or v22', 'v2')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const version = parseLbVersion(opts.lbVersion)
      const client = createBasePublicClient()

      let pairAddress: `0x${string}`
      let binStep = opts.binStep ? parseBinStep(Number(opts.binStep)) : undefined
      let tokenXAddr = opts.tokenX as string | undefined
      let tokenYAddr = opts.tokenY as string | undefined
      const xDecimals = opts.tokenXDecimals
        ? parseDecimals(Number(opts.tokenXDecimals), 'token-x-decimals')
        : undefined
      const yDecimals = opts.tokenYDecimals
        ? parseDecimals(Number(opts.tokenYDecimals), 'token-y-decimals')
        : undefined

      if (opts.pair) {
        pairAddress = getAddress(opts.pair)
        if (binStep === undefined) {
          throw new SectorOneError(
            'MISSING_BIN_STEP',
            'Provide --bin-step when using --pair, or omit --pair and pass tokens + bin-step.'
          )
        }
      } else {
        if (!opts.tokenX || !opts.tokenY || binStep === undefined) {
          throw new SectorOneError(
            'MISSING_ARGS',
            'Provide --pair, or --token-x, --token-y, and --bin-step.'
          )
        }
        if (xDecimals === undefined || yDecimals === undefined) {
          throw new SectorOneError(
            'MISSING_DECIMALS',
            'Provide --token-x-decimals and --token-y-decimals.'
          )
        }
        const tokenX = makeToken({ address: opts.tokenX, decimals: xDecimals })
        const tokenY = makeToken({ address: opts.tokenY, decimals: yDecimals })
        const pairEntity = new PairV2(tokenX, tokenY)
        const lbPair = await pairEntity.fetchLBPair(
          binStep,
          version,
          client,
          ChainId.BASE
        )
        pairAddress = getAddress(lbPair.LBPair)
        tokenXAddr = tokenX.address
        tokenYAddr = tokenY.address
      }

      const reserves = await PairV2.getLBPairReservesAndId(
        pairAddress,
        version,
        client
      )

      const payload: Record<string, unknown> = {
        chainId: 8453,
        version,
        pair: pairAddress,
        binStep,
        activeId: reserves.activeId,
        reserveX: reserves.reserveX.toString(),
        reserveY: reserves.reserveY.toString()
      }

      if (xDecimals !== undefined && yDecimals !== undefined) {
        payload.reserveXFormatted = formatUnits(reserves.reserveX, xDecimals)
        payload.reserveYFormatted = formatUnits(reserves.reserveY, yDecimals)
      }
      if (tokenXAddr) payload.tokenX = getAddress(tokenXAddr)
      if (tokenYAddr) payload.tokenY = getAddress(tokenYAddr)

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `Pair: ${pairAddress}`,
        `Active bin: ${reserves.activeId}`,
        `Reserve X: ${payload.reserveXFormatted ?? reserves.reserveX}`,
        `Reserve Y: ${payload.reserveYFormatted ?? reserves.reserveY}`
      ])
    })
}
