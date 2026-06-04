import { ChainId, Token, WNATIVE } from '@sectorone/sdk-core'
import {
  Bin,
  LBRouterV22ABI,
  LB_ROUTER_V22_ADDRESS,
  LBRouterV21ABI,
  LB_ROUTER_ADDRESS,
  LBRouterABI,
  LIQUIDITY_HELPER_V2_ADDRESS,
  LiquidityHelperV2ABI,
  LiquidityDistribution,
  PairV2,
  PoolVersion,
  RouteV2,
  TradeV2,
  type Quote
} from '@sectorone/sdk-v2'
import {
  encodeFunctionData,
  getAddress,
  zeroAddress,
  type Address
} from 'viem'
import { asSdkClient, type BasePublicClient } from './client.js'
import { bpsToPercent, formatRawAmount, makeTokenAmount, parseTokenAmount, toJSBI } from './amounts.js'
import { encodeRouterCall, toMcpCall } from './calldata.js'
import { SectorOneError } from './errors.js'
import { defaultBaseTokens, isWethAddress, makeToken } from './tokens.js'
import type { LbVersion, McpCall, RouteHop } from './types.js'
import { buildApprovalIfNeeded } from './approvals.js'

const CHAIN = ChainId.BASE

export function poolVersionToLb(version: PoolVersion | number): LbVersion {
  if (version === PoolVersion.V2 || version === 1) return 'v2'
  return 'v22'
}

export function quoteRouteHops(quote: Quote): RouteHop[] {
  return quote.pairs.map((pair, i) => ({
    pair: getAddress(pair),
    binStep: Number(quote.binSteps[i]),
    version: poolVersionToLb(Number(quote.versions[i] ?? PoolVersion.V2_2))
  }))
}

/** Resolve LB line version from quoter path (all hops should match). */
export function resolveRouteLbVersion(quote: Quote): LbVersion {
  const versions = quote.versions.map((v) => poolVersionToLb(Number(v)))
  const unique = [...new Set(versions)]
  if (unique.length > 1) {
    throw new SectorOneError(
      'MIXED_VERSION_ROUTE',
      'Route mixes LB v2.0 and v2.2 hops. Split the trade or use a single-version path.'
    )
  }
  return unique[0] ?? 'v2'
}

export function getRouterAddress(version: LbVersion): Address {
  if (version === 'v22') {
    const addr = LB_ROUTER_V22_ADDRESS[CHAIN]
    if (!addr || addr === zeroAddress) {
      throw new SectorOneError('NO_ROUTER', 'LB Router v2.2 is not configured for Base.')
    }
    return addr
  }
  return LB_ROUTER_ADDRESS[CHAIN]
}

export function getRouterAbi(version: LbVersion) {
  if (version === 'v22') return LBRouterV22ABI
  if (version === 'v2') return LBRouterABI
  return LBRouterV21ABI
}

export function resolveSwapTarget(quote: Quote): {
  router: Address
  version: LbVersion
} {
  const version = resolveRouteLbVersion(quote)
  return { router: getRouterAddress(version), version }
}

export async function quoteExactInput(params: {
  client: BasePublicClient
  tokenIn: Token
  tokenOut: Token
  amountIn: string
  tokenInDecimals: number
  slippageBps: number
  recipient: Address
  isNativeIn: boolean
  isNativeOut: boolean
  baseTokens?: Token[]
  maxHops?: number
  ttl?: number
}): Promise<{
  trade: TradeV2
  router: Address
  version: LbVersion
  swapParams: ReturnType<TradeV2['swapCallParameters']>
}> {
  const bases = params.baseTokens?.length
    ? params.baseTokens
    : defaultBaseTokens()

  const amount = makeTokenAmount(
    params.tokenIn,
    params.amountIn,
    params.tokenInDecimals
  )

  const sdkClient = asSdkClient(params.client)
  const pairs = PairV2.initPairs(
    PairV2.createAllTokenPairs(params.tokenIn, params.tokenOut, bases)
  )
  const routes = RouteV2.createAllRoutes(
    pairs,
    params.tokenIn,
    params.tokenOut,
    params.maxHops ?? 3
  )

  const trades = await TradeV2.getTradesExactIn(
    routes,
    amount,
    params.tokenOut,
    params.isNativeIn,
    params.isNativeOut,
    sdkClient,
    CHAIN
  )

  const trade = TradeV2.chooseBestTrade(trades as TradeV2[], true)
  if (!trade) {
    throw new SectorOneError(
      'NO_ROUTE',
      'No SectorOne DLMM route found. Check token pair, liquidity, and RPC.'
    )
  }

  const swapParams = trade.swapCallParameters({
    allowedSlippage: bpsToPercent(params.slippageBps),
    ttl: params.ttl ?? 1200,
    recipient: params.recipient
  })

  const { router, version } = resolveSwapTarget(trade.quote)

  return { trade, router, version, swapParams }
}

export async function assembleSwapCalls(params: {
  client: BasePublicClient
  wallet: Address
  trade: TradeV2
  router: Address
  version: LbVersion
  swapParams: ReturnType<TradeV2['swapCallParameters']>
  tokenIn: Token
  amountInRaw: bigint
  infiniteApproval?: boolean
}): Promise<McpCall[]> {
  const calls: McpCall[] = []

  if (!params.trade.isNativeIn) {
    const approval = await buildApprovalIfNeeded({
      client: params.client,
      wallet: params.wallet,
      token: getAddress(params.tokenIn.address),
      spender: params.router,
      amount: params.amountInRaw,
      infinite: params.infiniteApproval
    })
    if (approval.approvalNeeded && approval.call) {
      calls.push(approval.call)
    }
  }

  const abi = getRouterAbi(params.version)
  const swapData = encodeRouterCall({
    abi,
    functionName: params.swapParams.methodName,
    args: normalizeSwapArgs(params.swapParams.args, params.version)
  })

  const value =
    params.swapParams.value && params.swapParams.value !== '0x0'
      ? BigInt(params.swapParams.value)
      : 0n

  calls.push(toMcpCall(params.router, swapData, value))
  return calls
}

export async function buildAddLiquidityCalls(params: {
  client: BasePublicClient
  wallet: Address
  tokenX: Token
  tokenY: Token
  amountX: string
  amountY: string
  tokenXDecimals: number
  tokenYDecimals: number
  binStep: number
  version: LbVersion
  amountSlippageBps: number
  priceSlippageBps: number
  distribution: LiquidityDistribution
  ttl: number
  nativeX?: boolean
  nativeY?: boolean
  infiniteApproval?: boolean
}): Promise<{
  calls: McpCall[]
  router: Address
  pairAddress: Address
  activeId: number
}> {
  const sdkClient = asSdkClient(params.client)
  const pairEntity = new PairV2(params.tokenX, params.tokenY)
  const lbPair = await pairEntity.fetchLBPair(
    params.binStep,
    params.version,
    sdkClient,
    CHAIN
  )
  const pairAddress = getAddress(lbPair.LBPair)
  const { activeId } = await PairV2.getLBPairReservesAndId(
    pairAddress,
    params.version,
    sdkClient
  )

  const amount0 = makeTokenAmount(
    params.tokenX,
    params.amountX,
    params.tokenXDecimals
  )
  const amount1 = makeTokenAmount(
    params.tokenY,
    params.amountY,
    params.tokenYDecimals
  )

  const lp = pairEntity.addLiquidityParameters(
    params.binStep,
    amount0,
    amount1,
    bpsToPercent(params.amountSlippageBps),
    bpsToPercent(params.priceSlippageBps),
    params.distribution
  )

  const router = getRouterAddress(params.version)
  const abi = getRouterAbi(params.version)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + params.ttl)

  const liquidityParameters = {
    tokenX: getAddress(lp.tokenX.address),
    tokenY: getAddress(lp.tokenY.address),
    binStep: BigInt(params.binStep),
    amountX: BigInt(lp.amountX),
    amountY: BigInt(lp.amountY),
    amountXMin: BigInt(lp.amountXMin),
    amountYMin: BigInt(lp.amountYMin),
    activeIdDesired: BigInt(activeId),
    idSlippage: BigInt(lp.idSlippage),
    deltaIds: lp.deltaIds.map((id) => BigInt(id)),
    distributionX: lp.distributionX,
    distributionY: lp.distributionY,
    to: params.wallet,
    refundTo: params.wallet,
    deadline
  }

  const useNative =
    (params.nativeX && isWethAddress(getAddress(lp.tokenX.address))) ||
    (params.nativeY && isWethAddress(getAddress(lp.tokenY.address)))

  const functionName = useNative ? 'addLiquidityNATIVE' : 'addLiquidity'
  const data = encodeFunctionData({
    abi,
    functionName,
    args: [liquidityParameters]
  })

  const calls: McpCall[] = []

  if (!params.nativeX) {
    const ax = await buildApprovalIfNeeded({
      client: params.client,
      wallet: params.wallet,
      token: getAddress(lp.tokenX.address),
      spender: router,
      amount: BigInt(lp.amountX),
      infinite: params.infiniteApproval
    })
    if (ax.approvalNeeded && ax.call) calls.push(ax.call)
  }

  if (!params.nativeY) {
    const ay = await buildApprovalIfNeeded({
      client: params.client,
      wallet: params.wallet,
      token: getAddress(lp.tokenY.address),
      spender: router,
      amount: BigInt(lp.amountY),
      infinite: params.infiniteApproval
    })
    if (ay.approvalNeeded && ay.call) calls.push(ay.call)
  }

  let value = 0n
  if (useNative) {
    if (params.nativeX && isWethAddress(getAddress(lp.tokenX.address))) {
      value = BigInt(lp.amountX)
    } else if (params.nativeY && isWethAddress(getAddress(lp.tokenY.address))) {
      value = BigInt(lp.amountY)
    }
  }

  calls.push(toMcpCall(router, data, value))

  return { calls, router, pairAddress, activeId }
}

export async function readPositionAmounts(params: {
  client: BasePublicClient
  wallet: Address
  pair: Address
  binIds: number[]
  tokenX?: Token
  tokenY?: Token
}): Promise<{
  amountsX: bigint[]
  amountsY: bigint[]
  formatted?: { amountsX: string[]; amountsY: string[] }
}> {
  const [amountsX, amountsY] = await params.client.readContract({
    address: LIQUIDITY_HELPER_V2_ADDRESS[CHAIN],
    abi: LiquidityHelperV2ABI,
    functionName: 'getAmountsOf',
    args: [
      params.pair,
      params.wallet,
      params.binIds.map((id) => BigInt(id))
    ]
  })

  const result: {
    amountsX: bigint[]
    amountsY: bigint[]
    formatted?: { amountsX: string[]; amountsY: string[] }
  } = { amountsX: [...amountsX], amountsY: [...amountsY] }

  if (params.tokenX && params.tokenY) {
    result.formatted = {
      amountsX: amountsX.map((a) =>
        formatRawAmount(a, params.tokenX!.decimals)
      ),
      amountsY: amountsY.map((a) =>
        formatRawAmount(a, params.tokenY!.decimals)
      )
    }
  }

  return result
}

export function formatQuoteOutput(params: {
  trade: TradeV2
  router: Address
  swapParams: ReturnType<TradeV2['swapCallParameters']>
  slippageBps: number
  tokenIn: Token
  tokenOut: Token
  amountInRaw: bigint
}) {
  const { trade, router, swapParams } = params
  return {
    type: 'EXACT_INPUT' as const,
    chainId: 8453,
    router,
    tokenIn: trade.inputAmount.token.address,
    tokenOut: trade.outputAmount.token.address,
    amountInRaw: params.amountInRaw.toString(),
    expectedOutRaw: trade.outputAmount.raw.toString(),
    expectedOutFormatted: trade.outputAmount.toSignificant(8),
    priceImpactPercent: trade.priceImpact.toSignificant(4),
    allowedSlippageBps: params.slippageBps,
    route: quoteRouteHops(trade.quote),
    swap: {
      methodName: swapParams.methodName,
      args: swapParams.args,
      value: swapParams.value
    }
  }
}

function normalizeSwapArgs(
  args: ReturnType<TradeV2['swapCallParameters']>['args'],
  version: LbVersion
): readonly unknown[] {
  const pathArg = args.find(
    (a): a is { pairBinSteps: string[]; versions: readonly number[]; tokenPath: readonly string[] } =>
      typeof a === 'object' && a !== null && 'pairBinSteps' in a
  )

  if (version === 'v2' && pathArg) {
    const amountIn = BigInt(String(args[0]))
    const amountOutMin = BigInt(String(args[1]))
    const to = getAddress(String(args[3]))
    const deadline = BigInt(String(args[4]))
    return [
      amountIn,
      amountOutMin,
      pathArg.pairBinSteps.map((s) => BigInt(s)),
      pathArg.tokenPath.map((t) => getAddress(t)),
      to,
      deadline
    ]
  }

  return args.map((arg, index) => {
    if (typeof arg === 'object' && arg !== null && 'pairBinSteps' in arg) {
      const path = arg as {
        pairBinSteps: string[]
        versions: readonly number[]
        tokenPath: readonly string[]
      }
      return {
        pairBinSteps: path.pairBinSteps.map((s) => BigInt(s)),
        versions: [...path.versions],
        tokenPath: path.tokenPath.map((t) => getAddress(t))
      }
    }
    if (index === 3 && typeof arg === 'string') {
      return getAddress(arg)
    }
    if (typeof arg === 'string' && arg.startsWith('0x')) {
      return BigInt(arg)
    }
    return arg
  })
}

export function parseDistribution(name: string): LiquidityDistribution {
  const upper = name.toUpperCase()
  if (upper === 'SPOT') return LiquidityDistribution.SPOT
  if (upper === 'CURVE') return LiquidityDistribution.CURVE
  if (upper === 'BID_ASK' || upper === 'BIDASK') {
    return LiquidityDistribution.BID_ASK
  }
  throw new SectorOneError(
    'INVALID_DISTRIBUTION',
    `Unknown distribution "${name}". Use SPOT, CURVE, or BID_ASK.`
  )
}

export { Bin, PairV2, TradeV2, WNATIVE, CHAIN, formatRawAmount }
