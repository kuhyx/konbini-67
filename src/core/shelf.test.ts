import { describe, expect, it } from 'vitest'
import { REQUEST_FORM_ORDER, SHELF_MODE_ORDER, SHELF_TIERS, shelfSpecForShift } from './shelf'

describe('shelf escalation', () => {
  it.each(SHELF_TIERS)('tier %# is well formed', (spec) => {
    expect(SHELF_MODE_ORDER).toContain(spec.mode)
    expect(spec.lookupFreezeMs).toBeGreaterThanOrEqual(0)
    expect(spec.lookupPenalty).toBeGreaterThanOrEqual(0)
    expect(spec.byNumberWeight).toBeGreaterThanOrEqual(0)
    expect(spec.byNumberWeight).toBeLessThanOrEqual(1)
    expect(typeof spec.reshuffles).toBe('boolean')
  })

  it('names both request forms', () => {
    expect(REQUEST_FORM_ORDER).toStrictEqual(['by-number', 'by-brand'])
  })

  it('gives free labelled reading on shifts 1-2', () => {
    for (const shift of [1, 2]) {
      const spec = shelfSpecForShift(shift)
      expect(spec.mode).toBe('labelled')
      expect(spec.lookupPenalty).toBe(0)
    }
  })

  it('fades the names and starts charging on shifts 3-5', () => {
    for (const shift of [3, 4, 5]) {
      const spec = shelfSpecForShift(shift)
      expect(spec.mode).toBe('faded')
      expect(spec.lookupPenalty).toBeGreaterThan(0)
      expect(spec.lookupFreezeMs).toBeGreaterThan(0)
    }
  })

  it('goes to bare numbers from shift 6', () => {
    for (const shift of [6, 9, 40]) {
      expect(shelfSpecForShift(shift).mode).toBe('bare')
    }
  })

  it('makes the lookup cost strictly rise with each tier', () => {
    const [easy, mid, hard] = [
      shelfSpecForShift(1),
      shelfSpecForShift(4),
      shelfSpecForShift(7),
    ]
    expect(mid.lookupPenalty).toBeGreaterThan(easy.lookupPenalty)
    expect(hard.lookupPenalty).toBeGreaterThan(mid.lookupPenalty)
  })

  it('shifts requests from numbers toward brand names as you improve', () => {
    expect(shelfSpecForShift(1).byNumberWeight).toBeGreaterThan(
      shelfSpecForShift(7).byNumberWeight,
    )
  })

  it('only reshuffles at the hardest tier', () => {
    expect(shelfSpecForShift(1).reshuffles).toBe(false)
    expect(shelfSpecForShift(4).reshuffles).toBe(false)
    // Present in the table so escalation is complete; wired up at M6.
    expect(shelfSpecForShift(7).reshuffles).toBe(true)
  })
})
