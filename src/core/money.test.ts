import { describe, expect, it } from 'vitest'
import {
  addDenom,
  DENOMS,
  EMPTY_PURSE,
  formatYen,
  greedyChange,
  optimalCount,
  purseCount,
  purseValue,
  removeDenom,
} from './money'

describe('money', () => {
  it('values an empty purse at zero', () => {
    expect(purseValue(EMPTY_PURSE)).toBe(0)
    expect(purseCount(EMPTY_PURSE)).toBe(0)
  })

  it('values and counts every denomination', () => {
    let purse = EMPTY_PURSE
    let expected = 0
    for (const denom of DENOMS) {
      purse = addDenom(purse, denom)
      expected += denom
    }
    expect(purseValue(purse)).toBe(expected)
    expect(purseCount(purse)).toBe(DENOMS.length)
  })

  it('adds and removes a denomination', () => {
    const one = addDenom(EMPTY_PURSE, 500)
    expect(one[500]).toBe(1)
    expect(removeDenom(one, 500)[500]).toBe(0)
  })

  it('never removes below zero', () => {
    expect(removeDenom(EMPTY_PURSE, 100)).toStrictEqual(EMPTY_PURSE)
  })

  it('makes zero change with no coins', () => {
    expect(greedyChange(0)).toStrictEqual(EMPTY_PURSE)
    expect(optimalCount(0)).toBe(0)
  })

  it('makes change that adds back up, for every amount in a wide range', () => {
    for (let amount = 0; amount <= 2000; amount += 1) {
      expect(purseValue(greedyChange(amount))).toBe(amount)
    }
  })

  it('uses the fewest coins for a known case', () => {
    // 3434 = 3x1000 + 4x100 + 3x10 + 4x1 = 14 pieces.
    const change = greedyChange(3434)
    expect(change[1000]).toBe(3)
    expect(change[100]).toBe(4)
    expect(change[10]).toBe(3)
    expect(change[1]).toBe(4)
    expect(optimalCount(3434)).toBe(14)
  })

  it('prefers one 500 over five 100s', () => {
    expect(greedyChange(500)[500]).toBe(1)
    expect(greedyChange(500)[100]).toBe(0)
    expect(optimalCount(500)).toBe(1)
  })

  it('beats or matches any other way of making the same amount', () => {
    // Greedy is optimal for the canonical JPY set. Compare against every
    // single-denomination alternative that divides evenly.
    for (const amount of [15, 60, 130, 740, 1250, 3434]) {
      const best = optimalCount(amount)
      // Every single-denomination alternative that divides evenly, as counts.
      const alternatives = DENOMS.filter((denom) => amount % denom === 0).map(
        (denom) => amount / denom,
      )
      for (const alternative of alternatives) {
        expect(best).toBeLessThanOrEqual(alternative)
      }
    }
  })

  it('formats yen with a currency sign and thousands separators', () => {
    expect(formatYen(1240)).toBe('¥1,240')
    expect(formatYen(0)).toBe('¥0')
  })
})
