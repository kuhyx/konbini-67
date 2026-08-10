/**
 * JPY money. Yen has no sub-unit, so every amount in this game is a plain
 * integer number of yen — there is no float arithmetic anywhere in the
 * scoring path, and therefore no rounding-mode or epsilon bug class.
 */

/**
 * The denominations a clerk actually handles at a konbini counter.
 *
 * Ordered high to low: `greedyChange` depends on descending order.
 */
export const DENOMS = [10_000, 5000, 1000, 500, 100, 50, 10, 5, 1] as const

export type Denom = (typeof DENOMS)[number]

/**
 * A handful of money: how many of each denomination.
 *
 * Keyed by the denomination union rather than an array index — under
 * `noUncheckedIndexedAccess` an index read would be `number | undefined`,
 * forcing an unreachable guard at every coin click that could never be
 * covered.
 */
export type Purse = Readonly<Record<Denom, number>>

export const EMPTY_PURSE: Purse = {
  10_000: 0,
  5000: 0,
  1000: 0,
  500: 0,
  100: 0,
  50: 0,
  10: 0,
  5: 0,
  1: 0,
}

/**
 * Total yen value of a purse.
 */
export const purseValue = (purse: Purse): number => {
  let total = 0
  for (const denom of DENOMS) {
    total += denom * purse[denom]
  }
  return total
}

/**
 * How many physical coins and notes a purse contains. This is the efficiency
 * axis: handing over five 100s instead of one 500 is correct but sloppy.
 */
export const purseCount = (purse: Purse): number => {
  let count = 0
  for (const denom of DENOMS) {
    count += purse[denom]
  }
  return count
}

/**
 * Adds one unit of `denom` to a purse.
 */
export const addDenom = (purse: Purse, denom: Denom): Purse => ({
  ...purse,
  [denom]: purse[denom] + 1,
})

/**
 * Removes one unit of `denom`, never going below zero.
 */
export const removeDenom = (purse: Purse, denom: Denom): Purse =>
  purse[denom] === 0 ? purse : { ...purse, [denom]: purse[denom] - 1 }

/**
 * The fewest-coins way to make `amount`.
 *
 * Greedy is provably optimal for the canonical JPY set (each denomination
 * divides the next one up cleanly enough), so this is a valid reference
 * optimum while the till is unlimited. When denomination counts become finite
 * (M5) greedy breaks and the reference must become bounded-coin DP.
 */
export const greedyChange = (amount: number): Purse => {
  const out: Record<Denom, number> = { ...EMPTY_PURSE }
  let left = amount
  for (const denom of DENOMS) {
    out[denom] = Math.floor(left / denom)
    left %= denom
  }
  return out
}

/**
 * The fewest number of coins/notes needed to make `amount`.
 */
export const optimalCount = (amount: number): number => purseCount(greedyChange(amount))

/**
 * Formats yen for display: `¥1,240`, and `-¥120` when the drawer is short.
 * The sign goes outside the symbol, not between it and the digits.
 */
export const formatYen = (amount: number): string => {
  const sign = amount < 0 ? '-' : ''
  return `${sign}¥${Math.abs(amount).toLocaleString('en-US')}`
}
