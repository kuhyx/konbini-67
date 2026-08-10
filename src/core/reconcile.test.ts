import { describe, expect, it } from 'vitest'
import { addDenom, EMPTY_PURSE, OPENING_FLOAT, purseValue } from './money'
import {
  actualDiscrepancy,
  expectedDrawer,
  RECONCILE_SCORE,
  reconcile,
  reconcilePoints,
} from './reconcile'

describe('expectedDrawer', () => {
  it('is the float plus what was taken in', () => {
    expect(expectedDrawer(OPENING_FLOAT, 5000)).toBe(purseValue(OPENING_FLOAT) + 5000)
  })

  it('is just the float before any sales', () => {
    expect(expectedDrawer(OPENING_FLOAT, 0)).toBe(purseValue(OPENING_FLOAT))
  })
})

describe('actualDiscrepancy', () => {
  it('is zero when the till holds exactly what it should', () => {
    expect(actualDiscrepancy(OPENING_FLOAT, purseValue(OPENING_FLOAT))).toBe(0)
  })

  it('is positive when the till is heavy — you short-changed someone', () => {
    const heavy = addDenom(OPENING_FLOAT, 100)
    expect(actualDiscrepancy(heavy, purseValue(OPENING_FLOAT))).toBe(100)
  })

  it('is negative when the till is light — you overpaid', () => {
    expect(actualDiscrepancy(EMPTY_PURSE, 500)).toBe(-500)
  })
})

describe('reconcile', () => {
  it('balances when the declaration matches', () => {
    const result = reconcile(-50, -50)
    expect(result.isBalanced).toBe(true)
    expect(result.error).toBe(0)
  })

  it('records how far the declaration itself was wrong', () => {
    const result = reconcile(0, -50)
    expect(result.isBalanced).toBe(false)
    expect(result.error).toBe(50)
  })

  it('keeps both numbers for the summary', () => {
    const result = reconcile(10, -20)
    expect(result.declared).toBe(10)
    expect(result.actual).toBe(-20)
  })
})

describe('reconcilePoints', () => {
  it('rewards an honest count, even of a till that is out', () => {
    // The skill is knowing, not having a perfect till.
    expect(reconcilePoints(reconcile(-50, -50))).toBe(RECONCILE_SCORE.declaredCorrectly)
    expect(reconcilePoints(reconcile(0, 0))).toBe(RECONCILE_SCORE.declaredCorrectly)
  })

  it('charges for a miscount in proportion to how wrong it was', () => {
    expect(reconcilePoints(reconcile(0, -30))).toBe(-30 * RECONCILE_SCORE.perYenWrong)
  })

  it('caps the penalty so one bad count cannot wipe out a shift', () => {
    expect(reconcilePoints(reconcile(0, -99_999))).toBe(-RECONCILE_SCORE.maxPenalty)
  })

  it('charges the same whichever way the miscount went', () => {
    expect(reconcilePoints(reconcile(40, 0))).toBe(reconcilePoints(reconcile(-40, 0)))
  })
})
