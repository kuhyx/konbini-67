/**
 * The hot case: food that cooks while you are doing something else.
 *
 * This is the first mechanic whose work continues when you are not looking at
 * it. Everything else in the shop is strictly one customer at a time — the
 * clock runs, but nothing *changes state* unless you act. A hotdog on the
 * roller does. That is the whole point of it, and the source of its pressure:
 * the timer does not pause for the queue.
 *
 * Cook state advances from the same tick the shift clock already uses, so a
 * seeded replay still reproduces a burnt hotdog exactly. There is no second
 * timer, and there must never be one.
 */

/**
 * What can be cooked.
 *
 * Coffee and ice cream are here despite not really cooking: they are the two
 * that need no roller and no oven, so they ship as the cheap proof that the
 * concurrent-timer plumbing works before hotdogs and pizza pile on top.
 */
export type HotItem = 'hotdog' | 'pizza' | 'coffee' | 'ice-cream'

export const HOT_ITEM_ORDER = [
  'hotdog',
  'pizza',
  'coffee',
  'ice-cream',
] as const satisfies readonly HotItem[]

export interface HotSpec {
  readonly label: string
  readonly emoji: string
  readonly price: number
  /**
   * Milliseconds until it is ready.
   */
  readonly cookMs: number
  /**
   * Milliseconds it stays good after that before it is ruined.
   *
   * The grace window is the actual mechanic: a long one is a background chore,
   * a short one is a thing you have to watch. Coffee has none to speak of —
   * it goes cold — while a hotdog can sit on the roller for a while.
   */
  readonly graceMs: number
}

export const HOT_ITEMS: Readonly<Record<HotItem, HotSpec>> = {
  hotdog: { label: 'Hotdog', emoji: '🌭', price: 240, cookMs: 20_000, graceMs: 25_000 },
  pizza: { label: 'Pizza Slice', emoji: '🍕', price: 320, cookMs: 30_000, graceMs: 20_000 },
  coffee: { label: 'Hot Coffee', emoji: '☕', price: 180, cookMs: 8000, graceMs: 12_000 },
  'ice-cream': { label: 'Soft Serve', emoji: '🍦', price: 260, cookMs: 5000, graceMs: 9000 },
}

/**
 * Where one portion has got to.
 */
export type CookStage = 'cooking' | 'ready' | 'ruined'

export const COOK_STAGE_ORDER = ['cooking', 'ready', 'ruined'] as const

export interface Cooking {
  readonly what: HotItem
  /**
   * Shift time this went on.
   */
  readonly startedMs: number
  /**
   * Distinguishes two portions of the same thing started at the same instant.
   */
  readonly id: number
}

/**
 * How far along a portion is at `nowMs`.
 *
 * Derived rather than stored, for the same reason mood is: a stage kept in
 * state is a stage that can be forgotten on some code path, and this one has
 * to stay true while the player is looking somewhere else entirely.
 */
export const stageOf = (cooking: Cooking, nowMs: number): CookStage => {
  const spec = HOT_ITEMS[cooking.what]
  const elapsed = nowMs - cooking.startedMs
  if (elapsed < spec.cookMs) {
    return 'cooking'
  }
  return elapsed < spec.cookMs + spec.graceMs ? 'ready' : 'ruined'
}

/**
 * Fraction of the way to being ready, 0-1, clamped.
 *
 * For a visual only: no number is ever shown. The hot case is read by looking
 * at it, like everything else in this shop.
 */
export const cookProgress = (cooking: Cooking, nowMs: number): number => {
  const spec = HOT_ITEMS[cooking.what]
  const elapsed = nowMs - cooking.startedMs
  return Math.max(0, Math.min(1, elapsed / spec.cookMs))
}

/**
 * How many of one thing are cooking or waiting.
 */
export const countOf = (cases: readonly Cooking[], what: HotItem): number =>
  cases.filter((portion) => portion.what === what).length

/**
 * Everything ruined, which is what a wasted portion looks like at cash-up.
 */
export const ruined = (cases: readonly Cooking[], nowMs: number): readonly Cooking[] =>
  cases.filter((portion) => stageOf(portion, nowMs) === 'ruined')

/**
 * The oldest ready portion of one thing, which is what you would actually
 * hand over — first cooked, first sold.
 */
export const oldestReady = (
  cases: readonly Cooking[],
  what: HotItem,
  nowMs: number,
): Cooking | undefined =>
  cases
    .filter((portion) => portion.what === what && stageOf(portion, nowMs) === 'ready')
    .toSorted((a, b) => a.startedMs - b.startedMs)[0]

/**
 * Takes one portion out of the case.
 */
export const remove = (cases: readonly Cooking[], id: number): readonly Cooking[] =>
  cases.filter((portion) => portion.id !== id)

/**
 * How many portions the case holds at once.
 *
 * A cap rather than unlimited: without one, the winning move is to fill the
 * roller at the start of the shift and never think about it again, which is
 * the opposite of a timer you have to watch.
 */
export const CASE_CAPACITY = 6
