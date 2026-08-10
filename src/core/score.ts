/**
 * Scoring. Three axes, all pure arithmetic over integers.
 *
 * Correctness is a binary gate — the whole premise is that the register does
 * not do the thinking for you, so wrong change has to actually cost something.
 * Efficiency and speed then reward fluency on top of mere accuracy.
 */

import { optimalCount, purseCount, purseValue, type Purse } from './money'

export const SCORE = {
  correctChange: 100,
  /**
   * Per surplus coin beyond the fewest-coins answer.
   */
  sloppyPerCoin: 8,
  wrongChange: -120,
  correctSlot: 60,
  wrongSlot: -80,
  /**
   * Full speed bonus, scaled down to zero as you hit twice par.
   */
  speedBonus: 40,
} as const

/**
 * Milliseconds of par time granted per item in the basket.
 */
export const PAR_MS_PER_ITEM = 2600

/**
 * Extra par time when the customer also wants cigarettes.
 */
export const PAR_MS_CIGARETTE = 3200

export interface ChangeGrade {
  readonly correct: boolean
  /**
   * Coins handed over beyond the fewest-coins answer.
   */
  readonly surplusCoins: number
  /**
   * Yen the drawer is off by. Negative means you shorted yourself.
   */
  readonly drawerDelta: number
  readonly points: number
}

/**
 * Grades one attempt at counting out change.
 */
export const gradeChange = (given: Purse, owed: number): ChangeGrade => {
  const value = purseValue(given)
  const isCorrect = value === owed
  if (!isCorrect) {
    return {
      correct: false,
      surplusCoins: 0,
      // Overpaying drains the drawer; underpaying leaves it heavy.
      drawerDelta: owed - value,
      points: SCORE.wrongChange,
    }
  }
  const surplusCoins = purseCount(given) - optimalCount(owed)
  return {
    correct: true,
    surplusCoins,
    drawerDelta: 0,
    points: SCORE.correctChange - surplusCoins * SCORE.sloppyPerCoin,
  }
}

/**
 * Par time for a transaction, in milliseconds.
 */
export const parMs = (itemCount: number, hasCigarette: boolean): number =>
  itemCount * PAR_MS_PER_ITEM + (hasCigarette ? PAR_MS_CIGARETTE : 0)

/**
 * Speed bonus: full marks at or under par, tapering to zero at twice par.
 */
export const speedPoints = (elapsedMs: number, par: number): number => {
  if (elapsedMs <= par) {
    return SCORE.speedBonus
  }
  if (elapsedMs >= par * 2) {
    return 0
  }
  const overrun = (elapsedMs - par) / par
  return Math.round(SCORE.speedBonus * (1 - overrun))
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

export const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'] as const satisfies readonly Grade[]

/**
 * End-of-shift letter grade from the average score per customer.
 */
export const gradeForShift = (score: number, served: number): Grade => {
  if (served === 0) {
    return 'D'
  }
  const per = score / served
  if (per >= 140) {
    return 'S'
  }
  if (per >= 110) {
    return 'A'
  }
  if (per >= 70) {
    return 'B'
  }
  if (per >= 30) {
    return 'C'
  }
  return 'D'
}
