import { describe, expect, it } from 'vitest'
import { purseValue } from './money'
import { createShift, HANDLE_MS, reduce, type ShiftState } from './shift'
import { MOOD_AT_MS } from './patience'
import { CASE_CAPACITY, HOT_ITEMS, type HotItem, stageOf } from './hotfood'

/**
A shift with one portion already on.
*/
const cooking = (what: HotItem = 'coffee'): ShiftState =>
  reduce(createShift(1), { kind: 'cook', what })

describe('hot food', () => {
  it('puts a portion on', () => {
    const state = cooking()
    expect(state.hotCase).toHaveLength(1)
    expect(state.hotCase[0]?.what).toBe('coffee')
    expect(state.message).toContain('on')
  })

  it('costs a moment of handling', () => {
    const state = cooking()
    expect(state.frozenUntilMs).toBe(state.elapsedMs + HANDLE_MS)
  })

  it('keeps cooking while you serve somebody else', () => {
    // The whole point of the mechanic: the timer does not pause for the queue.
    const state = cooking()
    const later = reduce({ ...state, frozenUntilMs: 0 }, {
      kind: 'tick',
      deltaMs: HOT_ITEMS.coffee.cookMs,
    })
    const portion = later.hotCase[0]
    if (portion === undefined) {
      throw new Error('expected a portion in the case')
    }
    expect(stageOf(portion, later.elapsedMs)).toBe('ready')
  })

  it('will not let you take something out before it is ready', () => {
    const state = cooking()
    const portion = state.hotCase[0]
    if (portion === undefined) {
      throw new Error('expected a portion')
    }
    const early = reduce({ ...state, frozenUntilMs: 0 }, { kind: 'take-out', id: portion.id })
    expect(early.hotCase).toHaveLength(1)
    expect(early.message).toContain('Not ready')
  })

  it('sells a portion that came out in time', () => {
    const state = cooking()
    const portion = state.hotCase[0]
    if (portion === undefined) {
      throw new Error('expected a portion')
    }
    const ready = reduce({ ...state, frozenUntilMs: 0 }, {
      kind: 'tick',
      deltaMs: HOT_ITEMS.coffee.cookMs,
    })
    const sold = reduce({ ...ready, frozenUntilMs: 0 }, { kind: 'take-out', id: portion.id })
    expect(sold.hotCase).toHaveLength(0)
    expect(sold.tally.hotSold).toBe(1)
    expect(sold.takings).toBe(HOT_ITEMS.coffee.price)
  })

  it.each(['coffee', 'hotdog'] as const)('puts the actual price of a %s in the drawer', (what) => {
    // Money is conserved: the drawer holds the opening float plus everything
    // taken in, and nothing else. A flat coin here instead of the real price
    // opened a gap the tally could never explain — green tests missed it
    // because they only ever checked `takings`, which was right all along.
    const state = cooking(what)
    const portion = state.hotCase[0]
    if (portion === undefined) {
      throw new Error('expected a portion')
    }
    const ready = reduce({ ...state, frozenUntilMs: 0 }, {
      kind: 'tick',
      deltaMs: HOT_ITEMS[what].cookMs,
    })
    const sold = reduce({ ...ready, frozenUntilMs: 0 }, { kind: 'take-out', id: portion.id })
    expect(purseValue(sold.drawer)).toBe(purseValue(sold.openingFloat) + sold.takings)
  })

  it('bins one that was left too long', () => {
    const state = cooking()
    const portion = state.hotCase[0]
    if (portion === undefined) {
      throw new Error('expected a portion')
    }
    const spec = HOT_ITEMS.coffee
    const late = reduce({ ...state, frozenUntilMs: 0 }, {
      kind: 'tick',
      deltaMs: spec.cookMs + spec.graceMs,
    })
    const binned = reduce({ ...late, frozenUntilMs: 0 }, { kind: 'take-out', id: portion.id })
    expect(binned.tally.binned).toBe(1)
    expect(binned.tally.hotSold).toBe(0)
    // Money the shop spent on nothing: no takings from a ruined portion.
    expect(binned.takings).toBe(0)
    expect(binned.message).toContain('ruined')
  })

  it('refuses to overfill the case', () => {
    // Without a cap, the winning move is to fill the roller once at the start
    // and never think about it again.
    let state = createShift(1)
    for (let n = 0; n < CASE_CAPACITY + 3; n += 1) {
      state = reduce({ ...state, frozenUntilMs: 0 }, { kind: 'cook', what: 'hotdog' })
    }
    expect(state.hotCase).toHaveLength(CASE_CAPACITY)
  })

  it('ignores a portion that is not in the case', () => {
    const state = cooking()
    expect(reduce({ ...state, frozenUntilMs: 0 }, { kind: 'take-out', id: 999 })).toStrictEqual({
      ...state,
      frozenUntilMs: 0,
    })
  })

  it('cannot be handled while your hands are busy', () => {
    const busy: ShiftState = { ...createShift(1), frozenUntilMs: 9_999_999 }
    expect(reduce(busy, { kind: 'cook', what: 'pizza' })).toStrictEqual(busy)
    const withFood: ShiftState = { ...cooking(), frozenUntilMs: 9_999_999 }
    const portion = withFood.hotCase[0]
    if (portion === undefined) {
      throw new Error('expected a portion')
    }
    expect(reduce(withFood, { kind: 'take-out', id: portion.id })).toStrictEqual(withFood)
  })

  it('survives a customer walking out', () => {
    // Cook state belongs to the shop, not to whoever happens to be at the
    // counter, so advancing to the next customer must not empty the case.
    const state = cooking('hotdog')
    const later = reduce({ ...state, frozenUntilMs: 0 }, {
      kind: 'tick',
      deltaMs: MOOD_AT_MS.leaving + 1000,
    })
    expect(later.tally.walkedOut).toBe(1)
    expect(later.hotCase).toHaveLength(1)
  })
})
