import { describe, expect, it } from 'vitest'
import { createShift, moodOf, reduce, type ShiftState } from './shift'
import { APOLOGY_MS, MOOD_AT_MS } from './patience'
import { RESTOCK_MS } from './stock'
import { CLEAN_MS, MESS_INTERVAL_MS, MESS_TOLERANCE } from './mess'
import { servePerfectly } from '../test/shift-fixtures'

/**
A shift run forward far enough that something has been dropped.
*/
const dirty = (count = 1): ShiftState => {
  let state = createShift(1)
  // Bounded: past the patience limit the customer walks out and `advance`
  // starts a fresh one, so a naive "tick until N messes" loop can spin for
  // ever. Each pass ticks exactly one mess into existence and resets the
  // wait, which is also closer to what a real shift looks like.
  for (let n = 0; n < count; n += 1) {
    state = reduce(state, { kind: 'tick', deltaMs: MESS_INTERVAL_MS })
    state = { ...state, customerStartMs: state.elapsedMs }
  }
  return state
}

describe('mess and cleaning', () => {
  it('drops something eventually, without being asked', () => {
    // Nobody tells you to clean; that is the whole reason the job slides.
    expect(dirty().messes.length).toBeGreaterThan(0)
  })

  it('does not drop anything in the first moments of a shift', () => {
    const fresh = reduce(createShift(1), { kind: 'tick', deltaMs: 100 })
    expect(fresh.messes).toStrictEqual([])
  })

  it('wipes up the one you clicked', () => {
    const state = dirty(2)
    const [first] = state.messes
    if (first === undefined) {
      throw new Error('expected a mess')
    }
    const after = reduce(state, { kind: 'clean', id: first.id })
    expect(after.messes).toHaveLength(state.messes.length - 1)
    expect(after.messes.some((mess) => mess.id === first.id)).toBe(false)
    expect(after.tally.cleaned).toBe(1)
  })

  it('costs a moment, but less than a trip out back', () => {
    const state = dirty()
    const [first] = state.messes
    if (first === undefined) {
      throw new Error('expected a mess')
    }
    const after = reduce(state, { kind: 'clean', id: first.id })
    expect(after.frozenUntilMs).toBe(after.elapsedMs + CLEAN_MS)
    expect(CLEAN_MS).toBeLessThan(RESTOCK_MS)
  })

  it('ignores a mess that is not there', () => {
    const state = dirty()
    expect(reduce(state, { kind: 'clean', id: 9999 })).toStrictEqual(state)
  })

  it('cannot be done while frozen', () => {
    const state = dirty()
    const [first] = state.messes
    if (first === undefined) {
      throw new Error('expected a mess')
    }
    const busy: ShiftState = { ...state, frozenUntilMs: 9_999_999 }
    expect(reduce(busy, { kind: 'clean', id: first.id })).toStrictEqual(busy)
  })

  it('keeps mess generation inside the seeded replay', () => {
    // Where a spill lands must come from the state rng, not a wall clock, or
    // the same seed stops reproducing the same shift.
    const a = dirty(3)
    const b = dirty(3)
    expect(JSON.stringify(a.messes)).toBe(JSON.stringify(b.messes))
  })
})

describe('patience', () => {
  it('starts patient, and nothing on screen counts it down', () => {
    expect(moodOf(createShift(1))).toBe('patient')
  })

  it('sours as the customer is kept waiting', () => {
    const waited = reduce(createShift(1), { kind: 'tick', deltaMs: MOOD_AT_MS.restless })
    expect(moodOf(waited)).toBe('restless')
  })

  it('lets them walk out once they have had enough', () => {
    // The whole penalty is the lost sale: no score deduction on top.
    const before = createShift(1)
    const after = reduce(before, { kind: 'tick', deltaMs: MOOD_AT_MS.leaving + 1000 })
    expect(after.tally.walkedOut).toBe(1)
    expect(after.customer.id).toBe(before.customer.id + 1)
    expect(after.takings).toBe(0)
  })

  it('buys back part of the wait when you apologise', () => {
    const waited = reduce(createShift(1), { kind: 'tick', deltaMs: MOOD_AT_MS.annoyed })
    expect(moodOf(waited)).toBe('annoyed')
    const sorry = reduce(waited, { kind: 'apologise' })
    expect(moodOf(sorry)).not.toBe('annoyed')
    expect(sorry.message).toContain('omatase')
  })

  it('costs a beat to say sorry', () => {
    const waited = reduce(createShift(1), { kind: 'tick', deltaMs: MOOD_AT_MS.annoyed })
    const sorry = reduce(waited, { kind: 'apologise' })
    expect(sorry.frozenUntilMs).toBe(sorry.elapsedMs + APOLOGY_MS)
  })

  it('cannot be apologised to before anyone minds', () => {
    // Otherwise it is a free action with no cost and no meaning.
    const fresh = createShift(1)
    expect(reduce(fresh, { kind: 'apologise' })).toStrictEqual(fresh)
  })

  it('cannot apologise while frozen', () => {
    const waited = reduce(createShift(1), { kind: 'tick', deltaMs: MOOD_AT_MS.annoyed })
    const busy: ShiftState = { ...waited, frozenUntilMs: 9_999_999 }
    expect(reduce(busy, { kind: 'apologise' })).toStrictEqual(busy)
  })

  it('does not carry one customer’s forgiveness to the next', () => {
    // One apology buying patience from everybody who came after would make
    // the button a permanent upgrade rather than a moment.
    const waited = reduce(createShift(1), { kind: 'tick', deltaMs: MOOD_AT_MS.annoyed })
    const sorry = reduce(waited, { kind: 'apologise' })
    const served = servePerfectly({ ...sorry, frozenUntilMs: 0 })
    expect(served.forgivenMs).toBe(0)
  })

  it('makes a filthy shop wear on people faster', () => {
    const justShort = MOOD_AT_MS.restless - 3000
    const tidy = reduce(createShift(1), { kind: 'tick', deltaMs: justShort })
    expect(moodOf(tidy)).toBe('patient')
    const grim: ShiftState = { ...tidy, messes: dirty(MESS_TOLERANCE + 6).messes }
    expect(moodOf(grim)).not.toBe('patient')
  })
})
