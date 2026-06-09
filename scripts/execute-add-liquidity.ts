/**
 * Local signed execution: add liquidity using PRIVATE_KEY (not Base MCP).
 * Requires .env — see .env.example. Never commit PRIVATE_KEY.
 */
import { getAddress, type Address } from 'viem'
import { createBasePublicClient } from '../src/lib/client.js'
import { buildAddLiquidityCalls, parseDistribution } from '../src/lib/dlmm.js'
import { makeToken, WETH_ADDRESS } from '../src/lib/tokens.js'
import { parseBinCount } from '../src/lib/bin-range.js'
import { parseLbVersion } from '../src/lib/validation.js'
import { parseTokenAmount } from '../src/lib/amounts.js'
import {
  createClients,
  envBool,
  parsePrivateKey,
  sendCalls,
  wrapWethIfNeeded,
  requireEnv
} from './execute-common.js'

async function main(): Promise<void> {
  const dryRun = envBool('DRY_RUN', true)
  const privateKey = parsePrivateKey()
  const { account, publicClient, walletClient } = createClients(privateKey)
  const wallet = account.address

  const tokenX = makeToken({
    address: requireEnv('TOKEN_X'),
    decimals: Number(requireEnv('TOKEN_X_DECIMALS')),
    symbol: 'TOKEN_X'
  })
  const tokenY = makeToken({
    address: requireEnv('TOKEN_Y'),
    decimals: Number(requireEnv('TOKEN_Y_DECIMALS')),
    symbol: 'TOKEN_Y'
  })

  const binStep = Number(requireEnv('BIN_STEP'))
  const version = parseLbVersion(process.env.LB_VERSION ?? 'v2')
  const distribution = parseDistribution(process.env.DISTRIBUTION ?? 'SPOT')
  const binCount = process.env.BIN_COUNT ? parseBinCount(Number(process.env.BIN_COUNT)) : undefined

  const client = createBasePublicClient()

  const wethIsX = getAddress(tokenX.address) === getAddress(WETH_ADDRESS)
  const wethIsY = getAddress(tokenY.address) === getAddress(WETH_ADDRESS)
  const wethNeeded =
    wethIsX && Number(requireEnv('AMOUNT_X')) > 0
      ? parseTokenAmount(requireEnv('AMOUNT_X'), tokenX.decimals)
      : wethIsY && Number(requireEnv('AMOUNT_Y')) > 0
        ? parseTokenAmount(requireEnv('AMOUNT_Y'), tokenY.decimals)
        : 0n

  if (wethNeeded > 0n) {
    await wrapWethIfNeeded({
      publicClient,
      walletClient,
      weth: WETH_ADDRESS,
      wallet,
      needed: wethNeeded,
      dryRun
    })
  }

  const built = await buildAddLiquidityCalls({
    client,
    wallet,
    tokenX,
    tokenY,
    amountX: requireEnv('AMOUNT_X'),
    amountY: requireEnv('AMOUNT_Y'),
    tokenXDecimals: tokenX.decimals,
    tokenYDecimals: tokenY.decimals,
    binStep,
    version,
    amountSlippageBps: Number(process.env.AMOUNT_SLIPPAGE_BPS ?? '50'),
    priceSlippageBps: Number(process.env.PRICE_SLIPPAGE_BPS ?? '50'),
    distribution,
    ttl: Number(process.env.TTL_SECONDS ?? '1200'),
    binCount
  })

  const approvalCount = built.approvalCalls
  const approvals = built.calls.slice(0, approvalCount)
  const liquidity = built.calls.slice(approvalCount)

  if (approvals.length > 0) {
    await sendCalls({
      walletClient,
      publicClient,
      calls: approvals,
      dryRun,
      label: 'approve'
    })
    const rebuilt = await buildAddLiquidityCalls({
      client,
      wallet,
      tokenX,
      tokenY,
      amountX: requireEnv('AMOUNT_X'),
      amountY: requireEnv('AMOUNT_Y'),
      tokenXDecimals: tokenX.decimals,
      tokenYDecimals: tokenY.decimals,
      binStep,
      version,
      amountSlippageBps: Number(process.env.AMOUNT_SLIPPAGE_BPS ?? '50'),
      priceSlippageBps: Number(process.env.PRICE_SLIPPAGE_BPS ?? '50'),
      distribution,
      ttl: Number(process.env.TTL_SECONDS ?? '1200'),
      binCount
    })
    const liqOnly = rebuilt.calls.slice(rebuilt.approvalCalls)
    await sendCalls({
      walletClient,
      publicClient,
      calls: liqOnly,
      dryRun,
      label: 'addLiquidity'
    })
  } else {
    await sendCalls({
      walletClient,
      publicClient,
      calls: liquidity,
      dryRun,
      label: 'addLiquidity'
    })
  }

  console.error(`Done. Pair ${built.pairAddress} activeId=${built.activeId}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
