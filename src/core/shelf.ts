/**
 * Cigarette shelf recall: how much help the wall gives you, by shift.
 *
 * The taxed-but-allowed lookup chart is the point of this mechanic. It makes
 * memorisation player-chosen rather than imposed, and it generates a legible
 * skill curve — lookups-per-shift is a stat you watch fall.
 */

/**
 * How much the shelf tells you during service.
 */
export type ShelfMode =
  /**
   * Slots show brand names. You are reading, not recalling.
   */
  | 'labelled'
  /**
   * Names faded; the lookup chart is available at a cost.
   */
  | 'faded'
  /**
   * Bare numbers, requests by brand name only.
   */
  | 'bare'

export const SHELF_MODE_ORDER = ['labelled', 'faded', 'bare'] as const satisfies readonly ShelfMode[]

/**
 * How the customer words the request.
 */
export type RequestForm =
  /**
   * "Number 47, please."
   */
  | 'by-number'
  /**
   * "Echo, please."
   */
  | 'by-brand'

export const REQUEST_FORM_ORDER = [
  'by-number',
  'by-brand',
] as const satisfies readonly RequestForm[]

export interface ShelfSpec {
  readonly mode: ShelfMode
  /**
   * Milliseconds the lookup chart freezes you for.
   */
  readonly lookupFreezeMs: number
  /**
   * Score deducted per lookup.
   */
  readonly lookupPenalty: number
  /**
   * Weight of `by-number` requests; the rest are `by-brand`.
   */
  readonly byNumberWeight: number
  /**
   * Whether the between-shift restock reshuffles slots.
   *
   * Present in the table from the start so the escalation is complete and
   * testable, but not wired into play until M6.
   */
  readonly reshuffles: boolean
}

/**
 * Escalation indexed by shift number. A data table, not a branch ladder:
 * one loop over the tiers covers every entry.
 */
export const SHELF_TIERS: readonly [ShelfSpec, ...ShelfSpec[]] = [
  // Shifts 1-2: free reading.
  { mode: 'labelled', lookupFreezeMs: 0, lookupPenalty: 0, byNumberWeight: 0.8, reshuffles: false },
  // Shifts 3-5: names fade, the chart costs you.
  { mode: 'faded', lookupFreezeMs: 2000, lookupPenalty: 15, byNumberWeight: 0.5, reshuffles: false },
  // Shifts 6+: bare numbers, brand-name requests, expensive chart.
  { mode: 'bare', lookupFreezeMs: 3000, lookupPenalty: 30, byNumberWeight: 0.2, reshuffles: true },
]

/**
 * The shelf rules in force on a given 1-based shift.
 */
export const shelfSpecForShift = (shift: number): ShelfSpec => {
  let tier = 2
  if (shift <= 2) {
    tier = 0
  } else if (shift <= 5) {
    tier = 1
  }
  // A non-empty tuple type guarantees index 0, so this needs no cast. The rest
  // is iterated rather than indexed: an index read would be `T | undefined`
  // and the undefined arm is unreachable, so it could never be covered.
  let out: ShelfSpec = SHELF_TIERS[0]
  let seen = 0
  for (const spec of SHELF_TIERS) {
    if (seen === tier) {
      out = spec
    }
    seen += 1
  }
  return out
}
