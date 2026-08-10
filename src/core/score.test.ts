import { describe, expect, it } from 'vitest'
import { addDenom, EMPTY_PURSE, greedyChange } from './money'
import {
  GRADE_ORDER,
  gradeChange,
  gradeForShift,
  PAR_MS_CIGARETTE,
  PAR_MS_PER_ITEM,
  parMs,
  SCORE,
  speedPoints,
} from './score'

describe('gradeChange', () => {
  it('rewards exact, fewest-coins change', () => {
    const grade = gradeChange(greedyChange(350), 350)
    expect(grade.correct).toBe(true)
    expect(grade.surplusCoins).toBe(0)
    expect(grade.drawerDelta).toBe(0)
    expect(grade.points).toBe(SCORE.correctChange)
  })

  it('accepts correct-but-sloppy change at a discount', () => {
    // 500 as five 100s: right money, four coins too many.
    let purse = EMPTY_PURSE
    for (let n = 0; n < 5; n += 1) {
      purse = addDenom(purse, 100)
    }
    const grade = gradeChange(purse, 500)
    expect(grade.correct).toBe(true)
    expect(grade.surplusCoins).toBe(4)
    expect(grade.points).toBe(SCORE.correctChange - 4 * SCORE.sloppyPerCoin)
    expect(grade.points).toBeLessThan(SCORE.correctChange)
  })

  it('penalises short change and books it against the drawer', () => {
    const grade = gradeChange(addDenom(EMPTY_PURSE, 100), 350)
    expect(grade.correct).toBe(false)
    expect(grade.points).toBe(SCORE.wrongChange)
    // Shorted the customer by 250, so the drawer is heavy by 250.
    expect(grade.drawerDelta).toBe(250)
  })

  it('penalises over-change and drains the drawer', () => {
    const grade = gradeChange(addDenom(EMPTY_PURSE, 500), 350)
    expect(grade.correct).toBe(false)
    expect(grade.drawerDelta).toBe(-150)
  })

  it('treats an empty tray for a non-zero debt as wrong', () => {
    expect(gradeChange(EMPTY_PURSE, 10).correct).toBe(false)
  })

  it('treats an empty tray for a zero debt as right', () => {
    expect(gradeChange(EMPTY_PURSE, 0).correct).toBe(true)
  })
})

describe('parMs', () => {
  it('scales with basket size', () => {
    expect(parMs(1, false)).toBe(PAR_MS_PER_ITEM)
    expect(parMs(3, false)).toBe(3 * PAR_MS_PER_ITEM)
  })

  it('allows extra time for a cigarette request', () => {
    expect(parMs(1, true)).toBe(PAR_MS_PER_ITEM + PAR_MS_CIGARETTE)
  })
})

describe('speedPoints', () => {
  it('gives full marks at or under par', () => {
    expect(speedPoints(0, 1000)).toBe(SCORE.speedBonus)
    expect(speedPoints(1000, 1000)).toBe(SCORE.speedBonus)
  })

  it('tapers between par and twice par', () => {
    const half = speedPoints(1500, 1000)
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(SCORE.speedBonus)
    expect(half).toBe(Math.round(SCORE.speedBonus * 0.5))
  })

  it('gives nothing at or beyond twice par', () => {
    expect(speedPoints(2000, 1000)).toBe(0)
    expect(speedPoints(9999, 1000)).toBe(0)
  })
})

describe('gradeForShift', () => {
  it('grades an unworked shift as D', () => {
    expect(gradeForShift(0, 0)).toBe('D')
  })

  it.each([
    [140, 'S'],
    [110, 'A'],
    [70, 'B'],
    [30, 'C'],
    [0, 'D'],
  ])('scores %i per customer as %s', (per, expected) => {
    expect(gradeForShift(per * 10, 10)).toBe(expected)
  })

  it('lists every grade it can return', () => {
    expect(GRADE_ORDER).toStrictEqual(['S', 'A', 'B', 'C', 'D'])
  })

  it('treats a negative score as D', () => {
    expect(gradeForShift(-500, 4)).toBe('D')
  })
})
