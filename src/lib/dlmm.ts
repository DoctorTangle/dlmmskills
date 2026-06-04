import { ChainId, Token, WNATIVE } from '@sectorone/sdk-core'
import {
  Bin,
  LBFactoryABI,
  LBFactoryV22ABI,
  LB_FACTORY_ADDRESS,
  LB_FACTORY_V22_ADDRESS,
  LBPairABI,
  LBPairV21ABI,
  LBRouterV22ABI,
  LB_ROUTER_V22_ADDRESS,
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
  return version === 'v22' ? LBRouterV22ABI : LBRouterABI
}

export function getFactoryAddress(version: LbVersion): Address {
  if (version === 'v22') {
    const addr = LB_FACTORY_V22_ADDRESS[CHAIN]
    if (!addr || addr === zeroAddress) {
      throw new SectorOneError('NO_FACTORY', 'LB Factory v2.2 is not configured for Base.')
    }
    return addr
  }
  return LB_FACTORY_ADDRESS[CHAIN]
}

export function getFactoryAbi(version: LbVersion) {
  return version === 'v22' ? LBFactoryV22ABI : LBFactoryABI
}

function getLbPairAbi(version: LbVersion) {
  return version === 'v22' ? LBPairV21ABI : LBPairABI
}

/** Scale per-bin LP balances by a fraction (0 < f <= 1). */
export function scaleLiquidityBalances(
  balances: readonly bigint[],
  fraction: number
): bigint[] {
  if (fraction >= 1) {
    return balances.map((b) => b)
  }
  const scale = Math.round(fraction * 1_000_000)
  if (scale <= 0) {
    throw new SectorOneError(
      'INVALID_FRACTION',
      'fraction is too small to remove any liquidity after scaling.'
    )
  }
  return balances.map((balance) => (balance * BigInt(scale)) / 1_000_000n)
}

export type ResolvedLbPair = {
  pairAddress: Address
  tokenX: Token
  tokenY: Token
  binStep: number
}

export async function resolveLbPair(params: {
  client: BasePublicClient
  version: LbVersion
  pair?: Address
  tokenX?: Token
  tokenY?: Token
  binStep?: number
}): Promise<ResolvedLbPair> {
  if (params.pair) {
    if (params.binStep === undefined) {
      throw new SectorOneError(
        'MISSING_BIN_STEP',
        'Provide --bin-step when using --pair, or omit --pair and pass tokens + bin-step.'
      )
    }
    if (!params.tokenX || !params.tokenY) {
      throw new SectorOneError(
        'MISSING_TOKENS',
        'Provide --token-x and --token-y (with decimals) when using --pair for remove liquidity.'
      )
    }
    return {
      pairAddress: getAddress(params.pair),
      tokenX: params.tokenX,
      tokenY: params.tokenY,
      binStep: params.binStep
    }
  }

  if (!params.tokenX || !params.tokenY || params.binStep === undefined) {
    throw new SectorOneError(
      'MISSING_ARGS',
      'Provide --pair + tokens + --bin-step, or --token-x, --token-y, and --bin-step.'
    )
  }

  const sdkClient = asSdkClient(params.client)
  const pairEntity = new PairV2(params.tokenX, params.tokenY)
  const lbPair = await pairEntity.fetchLBPair(
    params.binStep,
    params.version,
    sdkClient,
    CHAIN
  )

  return {
    pairAddress: getAddress(lbPair.LBPair),
    tokenX: params.tokenX,
    tokenY: params.tokenY,
    binStep: params.binStep
  }
}

export async function fetchUserLiquidityBalances(params: {
  client: BasePublicClient
  version: LbVersion
  pair: Address
  wallet: Address
  binIds: number[]
}): Promise<bigint[]> {
  const abi = getLbPairAbi(params.version)
  const accounts = params.binIds.map(() => params.wallet)
  const ids = params.binIds.map((id) => BigInt(id))

  if (params.binIds.length === 1) {
    const balance = await params.client.readContract({
      address: params.pair,
      abi,
      functionName: 'balanceOf',
      args: [params.wallet, ids[0]!]
    })
    return [balance]
  }

  const balances = await params.client.readContract({
    address: params.pair,
    abi,
    functionName: 'balanceOfBatch',
    args: [accounts, ids]
  })
  return [...balances]
}

async function fetchBinReservesForRemove(params: {
  client: BasePublicClient
  version: LbVersion
  pair: Address
  binIds: number[]
}): Promise<{ bins: { reserveX: bigint; reserveY: bigint }[]; totalSupplies: bigint[] }> {
  const abi = getLbPairAbi(params.version)
  const bins: { reserveX: bigint; reserveY: bigint }[] = []
  const totalSupplies: bigint[] = []

  for (const binId of params.binIds) {
    const [[reserveX, reserveY], totalSupply] = await Promise.all([
      params.client.readContract({
        address: params.pair,
        abi,
        functionName: 'getBin',
        args: [binId]
      }),
      params.client.readContract({
        address: params.pair,
        abi,
        functionName: 'totalSupply',
        args: [BigInt(binId)]
      })
    ])
    bins.push({ reserveX, reserveY })
    totalSupplies.push(totalSupply)
  }

  return { bins, totalSupplies }
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
  if (params.nativeX && !isWethAddress(getAddress(params.tokenX.address))) {
    throw new SectorOneError(
      'INVALID_NATIVE_SIDE',
      '--native-x requires token-x to be WETH (0x4200...0006), the native ETH side on Base.'
    )
  }
  if (params.nativeY && !isWethAddress(getAddress(params.tokenY.address))) {
    throw new SectorOneError(
      'INVALID_NATIVE_SIDE',
      '--native-y requires token-y to be WETH (0x4200...0006), the native ETH side on Base.'
    )
  }

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

export async function buildRemoveLiquidityCalls(params: {
  client: BasePublicClient
  wallet: Address
  version: LbVersion
  pair?: Address
  tokenX?: Token
  tokenY?: Token
  binStep?: number
  binIds: number[]
  /** Per-bin LP share amounts to burn (same order as binIds). */
  liquidityAmounts: bigint[]
  amountSlippageBps: number
  ttl: number
  nativeX?: boolean
  nativeY?: boolean
}): Promise<{
  calls: McpCall[]
  router: Address
  pairAddress: Address
  activeId: number
  amountXMin: bigint
  amountYMin: bigint
  liquidityAmounts: string[]
}> {
  if (params.nativeX && params.tokenX && !isWethAddress(getAddress(params.tokenX.address))) {
    throw new SectorOneError(
      'INVALID_NATIVE_SIDE',
      '--native-x requires token-x to be WETH (0x4200...0006), the native ETH side on Base.'
    )
  }
  if (params.nativeY && params.tokenY && !isWethAddress(getAddress(params.tokenY.address))) {
    throw new SectorOneError(
      'INVALID_NATIVE_SIDE',
      '--native-y requires token-y to be WETH (0x4200...0006), the native ETH side on Base.'
    )
  }

  const resolved = await resolveLbPair({
    client: params.client,
    version: params.version,
    pair: params.pair,
    tokenX: params.tokenX,
    tokenY: params.tokenY,
    binStep: params.binStep
  })

  if (params.liquidityAmounts.length !== params.binIds.length) {
    throw new SectorOneError(
      'INVALID_LIQUIDITY_AMOUNTS',
      'liquidity amount count must match bin id count.'
    )
  }

  for (const [i, amount] of params.liquidityAmounts.entries()) {
    if (amount <= 0n) {
      throw new SectorOneError(
        'ZERO_LIQUIDITY',
        `Liquidity amount for bin #${params.binIds[i]} must be greater than zero.`
      )
    }
  }

  const pairVersion = params.version === 'v22' ? 'v22' : 'v2'
  const { activeId } = await PairV2.getLBPairReservesAndId(
    resolved.pairAddress,
    pairVersion,
    asSdkClient(params.client)
  )

  const { bins, totalSupplies } = await fetchBinReservesForRemove({
    client: params.client,
    version: params.version,
    pair: resolved.pairAddress,
    binIds: params.binIds
  })

  const pairEntity = new PairV2(resolved.tokenX, resolved.tokenY)
  const amountsToRemove = params.liquidityAmounts.map((a) => a.toString())
  const { amountXMin, amountYMin } = pairEntity.calculateAmountsToRemove(
    params.binIds,
    activeId,
    bins,
    totalSupplies,
    amountsToRemove,
    bpsToPercent(params.amountSlippageBps)
  )

  const amountXMinBig = BigInt(amountXMin.toString())
  const amountYMinBig = BigInt(amountYMin.toString())

  const router = getRouterAddress(params.version)
  const abi = getRouterAbi(params.version)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + params.ttl)
  const ids = params.binIds.map((id) => BigInt(id))
  const amounts = params.liquidityAmounts.map((a) => a)

  const tokenXAddr = getAddress(resolved.tokenX.address)
  const tokenYAddr = getAddress(resolved.tokenY.address)

  const useNative =
    (params.nativeX && isWethAddress(tokenXAddr)) ||
    (params.nativeY && isWethAddress(tokenYAddr))

  let data: `0x${string}`

  if (useNative) {
    const wethIsX = isWethAddress(tokenXAddr)
    const token = wethIsX ? tokenYAddr : tokenXAddr
    const amountTokenMin = wethIsX ? amountYMinBig : amountXMinBig
    const amountNativeMin = wethIsX ? amountXMinBig : amountYMinBig
    const nativeFn = params.version === 'v22' ? 'removeLiquidityNATIVE' : 'removeLiquidityAVAX'

    data = encodeFunctionData({
      abi,
      functionName: nativeFn,
      args: [
        token,
        resolved.binStep,
        amountTokenMin,
        amountNativeMin,
        ids,
        amounts,
        params.wallet,
        deadline
      ]
    })
  } else {
    data = encodeFunctionData({
      abi,
      functionName: 'removeLiquidity',
      args: [
        tokenXAddr,
        tokenYAddr,
        resolved.binStep,
        amountXMinBig,
        amountYMinBig,
        ids,
        amounts,
        params.wallet,
        deadline
      ]
    })
  }

  return {
    calls: [toMcpCall(router, data, 0n)],
    router,
    pairAddress: resolved.pairAddress,
    activeId,
    amountXMin: amountXMinBig,
    amountYMin: amountYMinBig,
    liquidityAmounts: amountsToRemove
  }
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

function isZeroPairAddress(address: string): boolean {
  return getAddress(address) === zeroAddress
}

export async function assertBinStepHasPreset(params: {
  client: BasePublicClient
  version: LbVersion
  binStep: number
}): Promise<void> {
  const factory = getFactoryAddress(params.version)
  const abi = getFactoryAbi(params.version)

  if (params.version === 'v22') {
    const preset = (await params.client.readContract({
      address: factory,
      abi,
      functionName: 'getPreset',
      args: [BigInt(params.binStep)]
    })) as readonly unknown[]

    const baseFactor = preset[0] as bigint
    const isOpen = preset[6] as boolean
    if (baseFactor === 0n) {
      throw new SectorOneError(
        'BIN_STEP_NO_PRESET',
        `bin-step ${params.binStep} has no factory preset on LB v2.2. Run list-pairs or check allowed bin steps.`
      )
    }
    if (!isOpen) {
      throw new SectorOneError(
        'BIN_STEP_CLOSED',
        `bin-step ${params.binStep} preset is not open for new pools on LB v2.2.`
      )
    }
    return
  }

  const preset = (await params.client.readContract({
    address: factory,
    abi,
    functionName: 'getPreset',
    args: [BigInt(params.binStep)]
  })) as readonly bigint[]

  if (preset[0] === 0n) {
    throw new SectorOneError(
      'BIN_STEP_NO_PRESET',
      `bin-step ${params.binStep} has no factory preset on LB v2.0. Run list-pairs or check allowed bin steps.`
    )
  }

  const creationUnlocked = await params.client.readContract({
    address: factory,
    abi,
    functionName: 'creationUnlocked'
  })

  if (!creationUnlocked) {
    throw new SectorOneError(
      'CREATION_LOCKED',
      'LB v2.0 pair creation is locked on the factory. Try --lb-version v22 or wait until creation is unlocked.'
    )
  }
}

export async function buildCreatePoolCalls(params: {
  client: BasePublicClient
  version: LbVersion
  tokenX: Token
  tokenY: Token
  binStep: number
  activeId: number
}): Promise<{
  calls: McpCall[]
  router: Address
  tokenX: Address
  tokenY: Address
  binStep: number
  activeId: number
}> {
  const pairEntity = new PairV2(params.tokenX, params.tokenY)
  const sdkClient = asSdkClient(params.client)

  const existing = await pairEntity.fetchLBPair(
    params.binStep,
    params.version,
    sdkClient,
    CHAIN
  )

  if (!isZeroPairAddress(existing.LBPair)) {
    throw new SectorOneError(
      'PAIR_ALREADY_EXISTS',
      `LB pair already exists at ${getAddress(existing.LBPair)} for this token pair and bin-step ${params.binStep}. Use build-add-liquidity instead.`
    )
  }

  await assertBinStepHasPreset({
    client: params.client,
    version: params.version,
    binStep: params.binStep
  })

  const tokenXAddr = getAddress(pairEntity.token0.address)
  const tokenYAddr = getAddress(pairEntity.token1.address)
  const router = getRouterAddress(params.version)
  const abi = getRouterAbi(params.version)

  const data = encodeFunctionData({
    abi,
    functionName: 'createLBPair',
    args: [
      tokenXAddr,
      tokenYAddr,
      params.activeId,
      params.binStep
    ]
  })

  return {
    calls: [toMcpCall(router, data, 0n)],
    router,
    tokenX: tokenXAddr,
    tokenY: tokenYAddr,
    binStep: params.binStep,
    activeId: params.activeId
  }
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

/**
 * Rebuild SDK swap args into ABI-ready args for the resolved router.
 *
 * The SDK emits one of three EXACT_INPUT layouts depending on native legs:
 *   - swapExactNATIVEForTokens: [amountOutMin, path, to, deadline]
 *   - swapExactTokensForNATIVE: [amountIn, amountOutMin, path, to, deadline]
 *   - swapExactTokensForTokens: [amountIn, amountOutMin, path, to, deadline]
 *
 * Positions are derived from the path object (not hardcoded indices) so native
 * and non-native legs are handled identically. For the v2.0 router the path is
 * flattened to (pairBinSteps[], tokenPath[]) with no versions array; for v2.2
 * the Path struct is preserved.
 */
export function normalizeSwapArgs(
  args: ReturnType<TradeV2['swapCallParameters']>['args'],
  version: LbVersion
): readonly unknown[] {
  const pathIndex = args.findIndex(
    (a) => typeof a === 'object' && a !== null && 'pairBinSteps' in a
  )

  if (pathIndex === -1) {
    throw new SectorOneError(
      'INVALID_SWAP_ARGS',
      'Swap parameters are missing the router path.'
    )
  }

  const pathArg = args[pathIndex] as {
    pairBinSteps: string[]
    versions: readonly number[]
    tokenPath: readonly string[]
  }

  const leadingAmounts = args
    .slice(0, pathIndex)
    .map((a) => BigInt(String(a)))
  const to = getAddress(String(args[pathIndex + 1]))
  const deadline = BigInt(String(args[pathIndex + 2]))

  const pairBinSteps = pathArg.pairBinSteps.map((s) => BigInt(s))
  const tokenPath = pathArg.tokenPath.map((t) => getAddress(t))

  if (version === 'v2') {
    return [...leadingAmounts, pairBinSteps, tokenPath, to, deadline]
  }

  return [
    ...leadingAmounts,
    {
      pairBinSteps,
      versions: [...pathArg.versions],
      tokenPath
    },
    to,
    deadline
  ]
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
