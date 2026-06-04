import { Bin } from '@sectorone/sdk-v2'
import type { Token } from '@sectorone/sdk-core'
import { PairV2 } from '@sectorone/sdk-v2'
import { getAddress, type Address } from 'viem'
import { SectorOneError } from './errors.js'
import { DEFAULT_ACTIVE_BIN_ID } from './validation.js'

export type CreatePoolPriceMode =
  | 'explicitActiveId'
  | 'inputTokenYPerInputTokenX'
  | 'sortedTokenYPerSortedTokenX'

export type ResolvedCreatePoolPrice = {
  activeId: number
  priceMode: CreatePoolPriceMode
  priceSemantic: 'inputTokenYPerInputTokenX' | 'sortedTokenYPerSortedTokenX'
  priceUsedForBinMath: number
  inputTokenX: Address
  inputTokenY: Address
  sortedTokenX: Address
  sortedTokenY: Address
  inputOrderWasSorted: boolean
  impliedSortedYPerSortedX: number
}

export function getPairSortOrder(
  tokenX: Token,
  tokenY: Token
): {
  pair: PairV2
  sortedTokenX: Address
  sortedTokenY: Address
  inputTokenX: Address
  inputTokenY: Address
  inputOrderWasSorted: boolean
} {
  const pair = new PairV2(tokenX, tokenY)
  const sortedTokenX = getAddress(pair.token0.address)
  const sortedTokenY = getAddress(pair.token1.address)
  const inputTokenX = getAddress(tokenX.address)
  const inputTokenY = getAddress(tokenY.address)
  const inputOrderWasSorted =
    inputTokenX === sortedTokenX && inputTokenY === sortedTokenY

  return {
    pair,
    sortedTokenX,
    sortedTokenY,
    inputTokenX,
    inputTokenY,
    inputOrderWasSorted
  }
}

function parsePositivePrice(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new SectorOneError(
      'INVALID_PRICE',
      `${label} must be a positive number.`
    )
  }
  return value
}

/** Convert CLI token-y-per-token-x into sorted token1/token0 for Bin.getIdFromPrice. */
export function inputYPerInputXToSortedPrice(
  tokenX: Token,
  tokenY: Token,
  priceInputYPerInputX: number
): number {
  const { sortedTokenX, sortedTokenY, inputTokenX, inputOrderWasSorted } =
    getPairSortOrder(tokenX, tokenY)

  if (inputOrderWasSorted) {
    return priceInputYPerInputX
  }

  // CLI token-x is on-chain token1; CLI token-y is token0 → invert.
  if (inputTokenX === sortedTokenY) {
    return 1 / priceInputYPerInputX
  }

  throw new SectorOneError(
    'PRICE_ORDER_MISMATCH',
    'Could not map input token order to sorted LB tokens.'
  )
}

export function resolveCreatePoolActiveId(params: {
  tokenX: Token
  tokenY: Token
  binStep: number
  activeId?: number
  priceInputYPerInputX?: number
  priceSortedYPerSortedX?: number
}): ResolvedCreatePoolPrice {
  const order = getPairSortOrder(params.tokenX, params.tokenY)

  const hasActiveId = params.activeId !== undefined
  const hasInputPrice = params.priceInputYPerInputX !== undefined
  const hasSortedPrice = params.priceSortedYPerSortedX !== undefined
  const modeCount = [hasActiveId, hasInputPrice, hasSortedPrice].filter(Boolean)
    .length

  if (modeCount > 1) {
    throw new SectorOneError(
      'CREATE_PRICE_MODE_REQUIRED',
      'Specify at most one of --active-id, --price-token-y-per-token-x, or --price-sorted-y-per-sorted-x.'
    )
  }

  if (modeCount === 0) {
    const activeId = DEFAULT_ACTIVE_BIN_ID
    const implied = Bin.getPriceFromId(activeId, params.binStep)
    return {
      activeId,
      priceMode: 'explicitActiveId',
      priceSemantic: 'sortedTokenYPerSortedTokenX',
      priceUsedForBinMath: implied,
      inputTokenX: order.inputTokenX,
      inputTokenY: order.inputTokenY,
      sortedTokenX: order.sortedTokenX,
      sortedTokenY: order.sortedTokenY,
      inputOrderWasSorted: order.inputOrderWasSorted,
      impliedSortedYPerSortedX: implied
    }
  }

  if (hasActiveId) {
    const activeId = params.activeId!
    const implied = Bin.getPriceFromId(activeId, params.binStep)
    return {
      activeId,
      priceMode: 'explicitActiveId',
      priceSemantic: 'sortedTokenYPerSortedTokenX',
      priceUsedForBinMath: implied,
      inputTokenX: order.inputTokenX,
      inputTokenY: order.inputTokenY,
      sortedTokenX: order.sortedTokenX,
      sortedTokenY: order.sortedTokenY,
      inputOrderWasSorted: order.inputOrderWasSorted,
      impliedSortedYPerSortedX: implied
    }
  }

  if (hasSortedPrice) {
    if (!order.inputOrderWasSorted) {
      throw new SectorOneError(
        'PRICE_REQUIRES_SORTED_INPUT_ORDER',
        '--token-x must be the lower-address token (on-chain token0) when using --price-sorted-y-per-sorted-x, or use --price-token-y-per-token-x with your CLI token order.'
      )
    }
    const price = parsePositivePrice(
      params.priceSortedYPerSortedX!,
      '--price-sorted-y-per-sorted-x'
    )
    const activeId = Bin.getIdFromPrice(price, params.binStep)
    return {
      activeId,
      priceMode: 'sortedTokenYPerSortedTokenX',
      priceSemantic: 'sortedTokenYPerSortedTokenX',
      priceUsedForBinMath: price,
      inputTokenX: order.inputTokenX,
      inputTokenY: order.inputTokenY,
      sortedTokenX: order.sortedTokenX,
      sortedTokenY: order.sortedTokenY,
      inputOrderWasSorted: true,
      impliedSortedYPerSortedX: Bin.getPriceFromId(activeId, params.binStep)
    }
  }

  const priceInput = parsePositivePrice(
    params.priceInputYPerInputX!,
    '--price-token-y-per-token-x'
  )
  const sortedPrice = inputYPerInputXToSortedPrice(
    params.tokenX,
    params.tokenY,
    priceInput
  )
  const activeId = Bin.getIdFromPrice(sortedPrice, params.binStep)

  return {
    activeId,
    priceMode: 'inputTokenYPerInputTokenX',
    priceSemantic: 'inputTokenYPerInputTokenX',
    priceUsedForBinMath: sortedPrice,
    inputTokenX: order.inputTokenX,
    inputTokenY: order.inputTokenY,
    sortedTokenX: order.sortedTokenX,
    sortedTokenY: order.sortedTokenY,
    inputOrderWasSorted: order.inputOrderWasSorted,
    impliedSortedYPerSortedX: Bin.getPriceFromId(activeId, params.binStep)
  }
}
