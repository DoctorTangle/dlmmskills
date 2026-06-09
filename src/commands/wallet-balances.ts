import { formatEther, getAddress } from 'viem'
import type { Command } from 'commander'
import { createBasePublicClient } from '../lib/client.js'
import { discoverLpBins } from '../lib/dlmm.js'
import { makeToken, WETH_ADDRESS, USDC_ADDRESS } from '../lib/tokens.js'
import { parseAddress, parseLbVersion } from '../lib/validation.js'
import { writeJson, writeHuman } from '../lib/output.js'

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  }
] as const

export function registerWalletBalances(program: Command): void {
  program
    .command('wallet-balances')
    .description('Read native ETH, WETH, USDC balances and optional LP bin count for a pair')
    .requiredOption('--wallet <address>')
    .option('--pair <address>', 'Optional LB pair for LP bin discovery')
    .option('--lb-version <v>', 'LB version when --pair is set', 'v2')
    .option('--scan-bins <n>', 'LP scan width when --pair is set', '60')
    .option('--json', 'JSON output to stdout')
    .action(async (opts) => {
      const wallet = parseAddress(opts.wallet, 'wallet')
      const client = createBasePublicClient()

      const ethBalance = await client.getBalance({ address: wallet })
      const weth = makeToken({ address: WETH_ADDRESS, decimals: 18, symbol: 'WETH' })
      const usdc = makeToken({ address: USDC_ADDRESS, decimals: 6, symbol: 'USDC' })

      const [wethBalance, usdcBalance] = await Promise.all(
        [weth, usdc].map((token) =>
          client.readContract({
            address: getAddress(token.address),
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [wallet]
          })
        )
      ) as [bigint, bigint]

      const payload: Record<string, unknown> = {
        chainId: 8453,
        wallet: getAddress(wallet),
        eth: ethBalance.toString(),
        ethFormatted: formatEther(ethBalance),
        weth: wethBalance.toString(),
        usdc: usdcBalance.toString()
      }

      if (opts.pair) {
        const pair = parseAddress(opts.pair, 'pair')
        const version = parseLbVersion(opts.lbVersion)
        const lp = await discoverLpBins({
          client,
          wallet,
          pair,
          version,
          scanBins: Number(opts.scanBins)
        })
        payload.pair = getAddress(pair)
        payload.lpBinCount = lp.bins.length
        payload.lpBinIds = lp.bins.map((b) => b.id)
      }

      if (opts.json) {
        writeJson(payload)
        return
      }

      writeHuman([
        `ETH: ${payload.ethFormatted}`,
        `WETH: ${wethBalance}`,
        `USDC: ${usdcBalance}`,
        ...(opts.pair ? [`LP bins on ${opts.pair}: ${payload.lpBinCount}`] : [])
      ])
    })
}
