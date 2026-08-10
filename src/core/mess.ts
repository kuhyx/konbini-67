/**
 * Spills and litter: the other half of the work nobody sees you do.
 *
 * Stocking has a customer attached to it — you restock because someone will
 * want the thing. Cleaning has nobody attached, which is exactly why it is the
 * job that slides. Its pressure has to come from somewhere else, so a dirty
 * shop wears on the people standing in it: mess feeds customer mood rather
 * than a cleanliness score. There is no scoreboard to tidy.
 *
 * Messes are physical objects with positions, like everything else on the
 * counter. You drag a cloth over one to clear it.
 */

import type { Point } from './layout'
import { type Rng, nextFloat } from './rng'

/**
 * What got dropped.
 *
 * Kept as a closed union rather than a free string so the UI can pick a glyph
 * without a lookup that might miss, and so the rate table below is total.
 */
export type MessKind = 'spill' | 'litter' | 'crumbs'

export const MESS_KIND_ORDER = ['spill', 'litter', 'crumbs'] as const satisfies readonly MessKind[]

export interface Mess {
  readonly kind: MessKind
  readonly at: Point
  /**
   * Distinguishes two messes of the same kind in the same place, so React
   * keys and "which one did you just clean" stay unambiguous.
   */
  readonly id: number
}

/**
 * Roughly how long between messes appearing, in milliseconds.
 *
 * Long enough that the shop is not a full-time cleaning job, short enough that
 * ignoring it across a three-minute shift is visible by the end.
 */
export const MESS_INTERVAL_MS = 25_000

/**
 * How long a wipe takes.
 *
 * Cheaper than a restocking trip: you are still behind the counter, and the
 * cost is meant to be an interruption rather than an errand.
 */
export const CLEAN_MS = 1500

/**
 * How many messes it takes before customers start minding.
 *
 * One spill is a shop; four is a state of affairs. Below the threshold there
 * is no penalty at all — the point is that neglect compounds, not that every
 * dropped wrapper is an incident.
 */
export const MESS_TOLERANCE = 3

/**
 * Where messes land: the customer's side and the floor in front of it, never
 * under the scanner where they would fight with the goods for space.
 */
const MESS_AREA = { x: 0.42, y: 0.6, width: 0.5, height: 0.34 }

/**
 * Picks a kind, weighted so spills — the ones that read as urgent — are not
 * the common case.
 */
const kindFor = (rng: Rng): MessKind => {
  const roll = nextFloat(rng)
  if (roll < 0.25) {
    return 'spill'
  }
  return roll < 0.65 ? 'litter' : 'crumbs'
}

/**
 * Drops one new mess somewhere in the mess area.
 */
export const dropMess = (rng: Rng, messes: readonly Mess[], id: number): readonly Mess[] => {
  const kind = kindFor(rng)
  const at: Point = {
    x: MESS_AREA.x + nextFloat(rng) * MESS_AREA.width,
    y: MESS_AREA.y + nextFloat(rng) * MESS_AREA.height,
  }
  return [...messes, { kind, at, id }]
}

/**
 * Removes the mess with the given id.
 *
 * By id rather than by index because the list is rendered sorted and a stale
 * index would clean the wrong thing — the same class of bug as a moving
 * button, but silent.
 */
export const wipe = (messes: readonly Mess[], id: number): readonly Mess[] =>
  messes.filter((mess) => mess.id !== id)

/**
 * How much the state of the shop is costing you, as a patience multiplier.
 *
 * Returns 1 while the shop is merely lived-in, rising once past the tolerance.
 * A multiplier rather than a subtraction so it scales with however long a
 * given customer was always going to wait.
 */
export const messMultiplier = (messes: readonly Mess[]): number =>
  messes.length <= MESS_TOLERANCE ? 1 : 1 + (messes.length - MESS_TOLERANCE) * 0.15
