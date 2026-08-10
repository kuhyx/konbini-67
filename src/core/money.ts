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
 * The counted float a shift opens with.
 *
 * Generous on purpose, and the size is a measured decision rather than a
 * guess. Every denomination except ¥5,000 runs net-negative across a shift —
 * ¥5,000 notes arrive and can never be handed back as change, so they are a
 * pure sink — which means no float *fixes* the drain, it only sets how long
 * you last. Sized so that across 40 seeds nothing runs dry inside a realistic
 * shift (~12 customers): 0/40 at 12, 3/40 at 15, and only a genuinely fast
 * clerk reaching 20+ has to go and ask the manager. That keeps the manager
 * trip as rare as it is on a real shift.
 */
export const OPENING_FLOAT: Purse = {
  10_000: 0,
  5000: 2,
  1000: 30,
  500: 30,
  100: 60,
  50: 30,
  10: 80,
  5: 30,
  1: 100,
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
 * The fewest-pieces way to make `amount` from what the drawer actually holds,
 * or `undefined` when it cannot be made at all.
 *
 * Greedy stays correct under bounds here — but only because the JPY set is a
 * **divisible chain** (5|10, 10|50, 50|100, 100|500, 500|1000, 1000|5000,
 * 5000|10000). For divisible systems the exchange argument makes greedy both
 * optimal and complete even with limited counts, which an exhaustive search
 * over 340,995 solvable (target, drawer) pairs confirms: zero cases where a
 * bounded-coin DP does better or succeeds where this fails.
 *
 * That divisibility is a real precondition, not a happy accident. Adding the
 * genuine ¥2000 note — which 1000 divides but which does not divide 5000 —
 * breaks the chain and produces 720 counterexamples. `money.test.ts` keeps a
 * DP oracle running against this so the day someone adds ¥2000, it fails
 * loudly instead of silently mis-grading every transaction.
 */
export const boundedChange = (amount: number, drawer: Purse): Purse | undefined => {
  const out: Record<Denom, number> = { ...EMPTY_PURSE }
  let left = amount
  for (const denom of DENOMS) {
    const take = Math.min(Math.floor(left / denom), drawer[denom])
    out[denom] = take
    left -= take * denom
  }
  return left === 0 ? out : undefined
}

/**
 * Whether the drawer can make `amount` exactly.
 */
export const canMakeChange = (amount: number, drawer: Purse): boolean =>
  boundedChange(amount, drawer) !== undefined

/**
 * Builds a purse by computing a count for each denomination.
 */
const mapDenoms = (count: (denom: Denom) => number): Purse => ({
  10_000: count(10_000),
  5000: count(5000),
  1000: count(1000),
  500: count(500),
  100: count(100),
  50: count(50),
  10: count(10),
  5: count(5),
  1: count(1),
})

/**
 * Adds every piece in `added` to `purse`. Used when a customer's cash goes in.
 */
export const mergePurses = (purse: Purse, added: Purse): Purse =>
  mapDenoms((denom) => purse[denom] + added[denom])

/**
 * Formats yen for display: `¥1,240`, and `-¥120` when the drawer is short.
 * The sign goes outside the symbol, not between it and the digits.
 */
export const formatYen = (amount: number): string => {
  const sign = amount < 0 ? '-' : ''
  return `${sign}¥${Math.abs(amount).toLocaleString('en-US')}`
}
