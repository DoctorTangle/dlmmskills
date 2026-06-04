import { describe, expect, it } from 'vitest'
import { bpsToPercent } from '../lib/amounts.js'

describe('bpsToPercent', () => {
  it('50 bps equals 0.5%', () => {
    const p = bpsToPercent(50)
    expect(p.toSignificant(3)).toBe('0.5')
    expect(p.toFixed(2)).toBe('0.50')
  })

  it('100 bps equals 1%', () => {
    const p = bpsToPercent(100)
    expect(p.toSignificant(3)).toBe('1')
  })
})
