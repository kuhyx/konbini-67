import { describe, expect, it } from 'vitest'
import {
  addDenom,
  boundedChange,
  canMakeChange,
  type Denom,
  DENOMS,
  EMPTY_PURSE,
  formatYen,
  greedyChange,
  OPENING_FLOAT,
  optimalCount,
  type Purse,
  purseCount,
  purseValue,
  removeDenom,
} from './money'
import { createRng, nextInt, type Rng } from './rng'

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

/**
 * Bounded-coin DP: the fewest pieces making `amount` from `drawer`, or
 * undefined when it cannot be made.
 *
 * This is a test oracle, not production code. `boundedChange` ships greedy
 * because greedy is provably safe for a *divisible* denomination chain, and
 * this DP is what proves that claim keeps holding — see the note on
 * `boundedChange` for why that precondition is worth guarding.
 */
const dpFewestPieces = (amount: number, drawer: Purse): number | undefined => {
  const best: number[] = Array.from({ length: amount + 1 }, () => Infinity)
  best[0] = 0
  for (const denom of DENOMS) {
    for (let taken = 0; taken < drawer[denom]; taken += 1) {
      for (let value = amount; value >= denom; value -= 1) {
        const candidate = (best[value - denom] ?? Infinity) + 1
        if (candidate < (best[value] ?? Infinity)) {
          best[value] = candidate
        }
      }
    }
  }
  const answer = best[amount] ?? Infinity
  return answer === Infinity ? undefined : answer
}

/**
 * A seeded drawer with a realistic mix: plenty of small change, few notes.
 */
const seededDrawer = (rng: Rng): Purse => {
  const out: Record<Denom, number> = { ...EMPTY_PURSE }
  const caps: Record<Denom, number> = {
    10_000: 2, 5000: 3, 1000: 6, 500: 6, 100: 12, 50: 8, 10: 15, 5: 8, 1: 15,
  }
  for (const denom of DENOMS) {
    out[denom] = nextInt(rng, caps[denom])
  }
  return out
}

describe('canMakeChange', () => {
  it('is true when the drawer can cover the amount exactly', () => {
    expect(canMakeChange(350, OPENING_FLOAT)).toBe(true)
  })

  it('is false when it cannot', () => {
    // A drawer holding only ¥500 pieces cannot make ¥350.
    const coarse = addDenom(EMPTY_PURSE, 500)
    expect(canMakeChange(350, coarse)).toBe(false)
  })

  it('is true for nothing owed, whatever the drawer holds', () => {
    expect(canMakeChange(0, EMPTY_PURSE)).toBe(true)
  })
})

describe('boundedChange when the drawer is short', () => {
  it('returns undefined rather than an approximate handful', () => {
    const coarse = addDenom(EMPTY_PURSE, 500)
    expect(boundedChange(350, coarse)).toBeUndefined()
  })

  it('spends what it has when that is exactly enough', () => {
    let drawer = addDenom(EMPTY_PURSE, 100)
    drawer = addDenom(drawer, 50)
    const change = boundedChange(150, drawer)
    expect(change).toStrictEqual(drawer)
  })
})

describe('boundedChange against a DP oracle', () => {
  // M5's done-condition from the approved plan, run literally: 500 seeded
  // (target, till) pairs.
  it('matches the bounded optimum over 500 seeded pairs', () => {
    let compared = 0
    let solvable = 0
    for (let seed = 1; seed <= 500; seed += 1) {
      const rng = createRng(seed)
      const drawer = seededDrawer(rng)
      const target = 1 + nextInt(rng, 2000)
      const greedy = boundedChange(target, drawer)
      const optimum = dpFewestPieces(target, drawer)
      compared += 1

      // Greedy succeeds exactly when the amount is makeable at all.
      expect(greedy === undefined).toBe(optimum === undefined)
      if (greedy === undefined || optimum === undefined) {
        continue
      }
      solvable += 1
      // Never more pieces than the true optimum...
      expect(purseCount(greedy)).toBe(optimum)
      // ...and never spending coins the drawer does not hold.
      for (const denom of DENOMS) {
        expect(greedy[denom]).toBeLessThanOrEqual(drawer[denom])
      }
      expect(purseValue(greedy)).toBe(target)
    }
    expect(compared).toBe(500)
    // Guards the guard: a run where nothing was solvable would pass vacuously.
    expect(solvable).toBeGreaterThan(50)
  })
})
