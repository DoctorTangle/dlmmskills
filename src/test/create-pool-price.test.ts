import { describe, expect, it } from 'vitest'
import { Token } from '@sectorone/sdk-core'
import { getAddress } from 'viem'
import {
  getPairSortOrder,
  inputYPerInputXToSortedPrice,
  resolveCreatePoolActiveId
} from '../lib/create-pool-price.js'
import { SectorOneError } from '../lib/errors.js'

const USDC = new Token(
  8453,
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  6,
  'USDC',
  'USD Coin'
)
const WETH = new Token(
  8453,
  '0x4200000000000000000000000000000000000006',
  18,
  'WETH',
  'Wrapped Ether'
)

describe('create pool price semantics', () => {
  it('on Base, WETH is token0 and USDC is token1 (address sort)', () => {
    const order = getPairSortOrder(USDC, WETH)
    expect(order.sortedTokenX).toBe(getAddress(WETH.address))
    expect(order.sortedTokenY).toBe(getAddress(USDC.address))
    expect(order.inputOrderWasSorted).toBe(false)
  })

  it('CLI token-x=WETH token-y=USDC matches sorted order', () => {
    const order = getPairSortOrder(WETH, USDC)
    expect(order.inputOrderWasSorted).toBe(true)
  })

  it('"3000 USDC per WETH" is sorted Y/X when using --price-sorted with WETH/USDC CLI order', () => {
    const r = resolveCreatePoolActiveId({
      tokenX: WETH,
      tokenY: USDC,
      binStep: 25,
      priceSortedYPerSortedX: 3000
    })
    expect(r.inputOrderWasSorted).toBe(true)
    expect(r.priceSemantic).toBe('sortedTokenYPerSortedTokenX')
    expect(Math.abs(r.impliedSortedYPerSortedX - 3000) / 3000).toBeLessThan(0.02)
  })

  it('input Y per X: USDC x, WETH y, price = WETH per USDC → sorted USDC per WETH ≈ 3000', () => {
    const sorted = inputYPerInputXToSortedPrice(USDC, WETH, 1 / 3000)
    expect(sorted).toBeCloseTo(3000, 0)
  })

  it('input Y per X: WETH x, USDC y, price = USDC per WETH → sorted = 3000', () => {
    const sorted = inputYPerInputXToSortedPrice(WETH, USDC, 3000)
    expect(sorted).toBeCloseTo(3000, 10)
  })

  it('rejects --price-sorted when CLI order is not sorted (USDC before WETH)', () => {
    expect(() =>
      resolveCreatePoolActiveId({
        tokenX: USDC,
        tokenY: WETH,
        binStep: 25,
        priceSortedYPerSortedX: 3000
      })
    ).toThrow(SectorOneError)

    try {
      resolveCreatePoolActiveId({
        tokenX: USDC,
        tokenY: WETH,
        binStep: 25,
        priceSortedYPerSortedX: 3000
      })
    } catch (e) {
      expect((e as SectorOneError).code).toBe('PRICE_REQUIRES_SORTED_INPUT_ORDER')
    }
  })

  it('rejects conflicting price modes', () => {
    expect(() =>
      resolveCreatePoolActiveId({
        tokenX: WETH,
        tokenY: USDC,
        binStep: 25,
        priceSortedYPerSortedX: 1,
        priceInputYPerInputX: 1
      })
    ).toThrow(SectorOneError)
  })
})
