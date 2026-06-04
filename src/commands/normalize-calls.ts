import { readFileSync } from 'node:fs'
import type { Command } from 'commander'
import { analyzeCalls, normalizeCalls } from '../lib/normalize-calls.js'
import type { RawUnsignedCall } from '../lib/types.js'
import { writeJson, writeHuman, writeWarning } from '../lib/output.js'
import { SectorOneError } from '../lib/errors.js'

export function registerNormalizeCalls(program: Command): void {
  program
    .command('normalize-calls')
    .description('Normalize unsigned txs to Base MCP send_calls format')
    .option('--input <path>', 'JSON file path (default: stdin)')
    .option(
      '--strict',
      'Reject calls not targeting a known SectorOne contract or ERC-20 approve'
    )
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      let raw: string
      if (opts.input) {
        raw = readFileSync(opts.input, 'utf8')
      } else {
        raw = await readStdin()
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new SectorOneError('INVALID_JSON', 'Input must be valid JSON.')
      }

      if (!Array.isArray(parsed)) {
        throw new SectorOneError(
          'INVALID_JSON',
          'Input must be a JSON array of call objects.'
        )
      }

      const payload = normalizeCalls(parsed as RawUnsignedCall[], {
        strict: Boolean(opts.strict)
      })

      // Risk summary always goes to stderr so stdout stays pure send_calls JSON.
      for (const risk of analyzeCalls(payload)) {
        if (!risk.known) {
          writeWarning(
            `Call #${risk.index}: UNKNOWN target ${risk.to} selector ${risk.selector} value ${risk.value}. Verify before send_calls.`
          )
        } else {
          const label = risk.isApprove ? 'ERC-20 approve' : 'known SectorOne contract'
          writeWarning(
            `Call #${risk.index}: ${label} (${risk.to}) selector ${risk.selector} value ${risk.value}.`
          )
        }
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([`Normalized ${payload.calls.length} call(s) for chain=base.`])
    })
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8').trim()
}
