import { describe, expect, it } from 'vitest'
import { ID_CHECK_MS, ID_SCORE, isSaleLegal, requiresIdCheck } from './id-check'
import { createShift, reduce, SHIFT_MS } from './shift'

import {
  cigShiftWithOutcome,
  serveWithId,
  serveWithoutId,
  restricted,
} from '../test/shift-fixtures'

describe('age checks', () => {
  it('does not mark anyone as checked until you ask', () => {
    expect(restricted().idShown).toBeUndefined()
  })

  it('shows you the card when you ask, and costs a moment', () => {
    const state = restricted()
    const after = reduce(state, { kind: 'ask-id' })
    expect(after.idShown).toBe(state.customer.idCard.outcome)
    expect(after.elapsedMs).toBe(state.elapsedMs + ID_CHECK_MS)
  })

  it('ignores a second look at the same card', () => {
    const once = reduce(restricted(), { kind: 'ask-id' })
    expect(reduce(once, { kind: 'ask-id' })).toStrictEqual(once)
  })

  it('never tells you what to do with what it shows you', () => {
    const after = reduce(restricted(), { kind: 'ask-id' })
    expect(after.message).not.toMatch(/refuse|should/i)
  })

  it('lets some customers take offence at being asked', () => {
    let seed = 1
    let state = createShift(seed)
    while (!state.customer.idCard.willArgue && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    expect(reduce(state, { kind: 'ask-id' }).message).toContain('Seriously?')
  })

  it('rewards refusing someone who cannot prove their age', () => {
    let seed = 1
    let state = createShift(seed)
    while (isSaleLegal(state.customer.idCard.outcome) && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    const after = reduce(reduce(state, { kind: 'ask-id' }), { kind: 'refuse-sale' })
    expect(after.tally.score).toBe(ID_SCORE.refusedCorrectly)
    expect(after.tally.served).toBe(1)
  })

  it('charges a little for turning away someone who was fine', () => {
    let seed = 1
    let state = createShift(seed)
    while (!isSaleLegal(state.customer.idCard.outcome) && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    const after = reduce(reduce(state, { kind: 'ask-id' }), { kind: 'refuse-sale' })
    expect(after.tally.score).toBe(ID_SCORE.refusedWrongly)
  })

  it('judges a refusal on the real card even if you never looked', () => {
    // Turning someone away on a hunch still gets graded against the truth —
    // you were right or you were not, whether or not you checked.
    const state = cigShiftWithOutcome('underage')
    const blind = reduce(state, { kind: 'refuse-sale' })
    const checked = reduce(reduce(state, { kind: 'ask-id' }), { kind: 'refuse-sale' })
    expect(blind.tally.score).toBe(checked.tally.score)
    expect(blind.tally.score).toBe(ID_SCORE.refusedCorrectly)
  })

  it('moves to the next customer after a refusal', () => {
    const state = restricted()
    const after = reduce(state, { kind: 'refuse-sale' })
    expect(after.customer.id).toBe(state.customer.id + 1)
    expect(after.phase).toBe('scanning')
  })

  it('charges heavily for selling to someone underage', () => {
    // Compared against the same sale to someone old enough: the change and
    // speed points are identical, so the gap is exactly the ID call.
    const underage = serveWithId(cigShiftWithOutcome('underage'))
    const legal = serveWithId(cigShiftWithOutcome('valid'))
    expect(underage.tally.score).toBeLessThan(legal.tally.score)
    expect(legal.tally.score - underage.tally.score).toBe(
      ID_SCORE.soldLegally - ID_SCORE.soldUnderage,
    )
  })

  it('charges for skipping the check on a restricted basket', () => {
    // Same customer, same money: the only difference is having looked.
    const state = cigShiftWithOutcome('valid')
    const withCheck = serveWithId(state)
    const without = serveWithoutId(state)
    expect(without.tally.score).toBeLessThan(withCheck.tally.score)
    expect(without.tally.score).toBeLessThan(0)
  })

  it('does not ask for ID on an ordinary basket', () => {
    let seed = 1
    let state = createShift(seed)
    while (requiresIdCheck(state.customer) && seed < 200) {
      seed += 1
      state = createShift(seed)
    }
    expect(requiresIdCheck(state.customer)).toBe(false)
  })

  it('is inert once the shift has closed', () => {
    const closed = reduce(createShift(1), { kind: 'tick', deltaMs: SHIFT_MS })
    expect(reduce(closed, { kind: 'ask-id' })).toStrictEqual(closed)
    expect(reduce(closed, { kind: 'refuse-sale' })).toStrictEqual(closed)
  })
})
