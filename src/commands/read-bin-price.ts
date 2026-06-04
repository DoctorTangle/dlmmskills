import { Bin } from '@sectorone/sdk-v2'
import type { Command } from 'commander'
import { SectorOneError } from '../lib/errors.js'
import { parseBinStep } from '../lib/validation.js'
import { writeJson, writeHuman } from '../lib/output.js'

export function registerReadBinPrice(program: Command): void {
  program
    .command('read-bin-price')
    .description('Convert between DLMM bin IDs and price')
    .option('--bin-id <n>', 'DLMM bin id')
    .option('--price <n>', 'Price (float)')
    .requiredOption('--bin-step <n>', 'Pair bin step')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const binStep = parseBinStep(Number(opts.binStep))

      const hasBinId = opts.binId !== undefined
      const hasPrice = opts.price !== undefined

      if (!hasBinId && !hasPrice) {
        throw new SectorOneError(
          'MISSING_INPUT',
          'Provide --bin-id and/or --price.'
        )
      }

      const payload: Record<string, number> = { binStep }

      if (hasBinId) {
        const binId = Number(opts.binId)
        payload.binId = binId
        payload.price = Bin.getPriceFromId(binId, binStep)
      }

      if (hasPrice) {
        const price = Number(opts.price)
        payload.price = price
        payload.binId = Bin.getIdFromPrice(price, binStep)
        if (!hasBinId) {
          payload.priceFromId = Bin.getPriceFromId(payload.binId, binStep)
        }
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman(
        Object.entries(payload).map(([k, v]) => `${k}: ${v}`)
      )
    })
}
