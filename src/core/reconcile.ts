/**
 * End-of-shift till reconciliation.
 *
 * Errors do not announce themselves during a shift — overpay a customer and
 * they walk off happy — so they accumulate silently and you meet all of them
 * at once when you cash up. That is exactly how a real till works, and it is
 * why "fix it in the books" is a screen at the end rather than an interruption
 * at the counter.
 *
 * The player does the arithmetic: count the drawer, work out what it *should*
 * hold, and declare the difference. Nothing here shows them the answer.
 */

import { purseValue, type Purse } from './money'

/**
 * What the drawer should contain if every transaction had been perfect:
 * the opening float plus everything taken in, less everything paid out.
 *
 * Since the drawer physically tracks both, the expected total is simply the
 * float plus the shift's takings.
 */
export const expectedDrawer = (openingFloat: Purse, takings: number): number =>
  purseValue(openingFloat) + takings

/**
 * How far the till is actually out.
 *
 * Positive means more money than there should be (you short-changed someone);
 * negative means less (you overpaid, or settled short).
 */
export const actualDiscrepancy = (drawer: Purse, expected: number): number =>
  purseValue(drawer) - expected

/**
 * How the books came out.
 */
export interface Reconciliation {
  /**
   * What the player said the drawer was out by.
   */
  readonly declared: number
  /**
   * What it was actually out by.
   */
  readonly actual: number
  /**
   * Whether the declaration matched.
   */
  readonly isBalanced: boolean
  /**
   * How far the declaration itself was wrong.
   */
  readonly error: number
}

/**
 * Checks the player's declared discrepancy against the real one.
 *
 * Declaring correctly is the skill: a clerk who knows their till is ¥50 down
 * and says so has done the job, while one who insists it balances when it does
 * not has not — even though both tills hold the same money.
 */
export const reconcile = (declared: number, actual: number): Reconciliation => ({
  declared,
  actual,
  isBalanced: declared === actual,
  error: declared - actual,
})

/**
 * Points for the books.
 *
 * Getting the count right is what scores, not having a perfect till: an honest
 * ¥50 shortfall you spotted beats a ¥50 shortfall you missed.
 */
export const RECONCILE_SCORE = {
  declaredCorrectly: 120,
  /**
   * Per yen of error in the declaration, capped so one bad count cannot wipe
   * out a whole shift.
   */
  perYenWrong: 1,
  maxPenalty: 200,
} as const

export const reconcilePoints = (result: Reconciliation): number => {
  if (result.isBalanced) {
    return RECONCILE_SCORE.declaredCorrectly
  }
  const penalty = Math.min(
    RECONCILE_SCORE.maxPenalty,
    Math.abs(result.error) * RECONCILE_SCORE.perYenWrong,
  )
  return -penalty
}
