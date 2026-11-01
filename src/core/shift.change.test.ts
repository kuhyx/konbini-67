import { describe, expect, it } from 'vitest'
import { EMPTY_PURSE, purseValue } from './money'
import { changeOwed, createShift, reduce, type ShiftState } from './shift'
import { tenderValue } from './customer'
import { scanAll, payExact, changing } from '../test/shift-fixtures'

describe('counting out change', () => {

  it('adds and removes denominations from the tray', () => {
    let state = reduce(changing(), { kind: 'give', denom: 100 })
    expect(state.tray[100]).toBe(1)
    state = reduce(state, { kind: 'take-back', denom: 100 })
    expect(state.tray[100]).toBe(0)
  })

  it('will not refund a piece that is not in the tray', () => {
    const state = changing()
    expect(reduce(state, { kind: 'take-back', denom: 500 })).toStrictEqual(state)
  })

  // The two ways of getting it wrong behave nothing alike, which is the whole
  // point of naming them separately.
  it('tells you the amount when you short-change the customer', () => {
    const ready = changing()
    const owed = changeOwed(ready)
    // Hand over one ¥10 coin less than the correct change: pull it back to
    // your own side before saying "that's everything".
    let state = payExact(ready)
    state = reduce(state, { kind: 'take-back', denom: 10 })
    const after = reduce(state, { kind: 'confirm' })
    expect(after.message).toContain('short')
    expect(after.message).toContain('They counted it')
    expect(after.tally.drawerDelta).toBe(10)
    expect(owed).toBeGreaterThan(0)
  })

  it('says nothing to the customer when you overpay, but books the loss', () => {
    const ready = changing()
    // Hand over one ¥10 coin more than the correct change: the customer is
    // delighted and silent, and the drawer is the thing that suffers.
    const state = reduce(payExact(ready), { kind: 'give', denom: 10 })
    const after = reduce(state, { kind: 'confirm' })
    expect(after.message).toContain('took it and left')
    expect(after.message).toContain('drawer is')
    expect(after.message).toContain('¥10')
    expect(after.tally.drawerDelta).toBe(-10)
  })

  it('ignores a value that is not a real denomination', () => {
    const state = changing()
    expect(reduce(state, { kind: 'give', denom: 3 })).toStrictEqual(state)
  })

  it('ignores coins outside the changing phase', () => {
    const state = createShift(1)
    expect(reduce(state, { kind: 'give', denom: 100 })).toStrictEqual(state)
    expect(reduce(state, { kind: 'take-back', denom: 100 })).toStrictEqual(state)
  })

  it('will not confirm before everything is rung up', () => {
    const state = createShift(1)
    expect(reduce(state, { kind: 'confirm' })).toStrictEqual(state)
  })

  it('will not confirm a part-scanned basket even in the changing phase', () => {
    // Reach `changing` legitimately, then rewind the scan count: this is the
    // "not everything rung up" guard rather than the phase guard.
    const partial: ShiftState = { ...changing(), scanned: 0 }
    expect(reduce(partial, { kind: 'confirm' }).tally.served).toBe(0)
  })

  it('will not confirm with the cigarette request outstanding', () => {
    let seed = 1
    while (createShift(seed).customer.cigarette === undefined) {
      seed += 1
    }
    const atShelf = scanAll(createShift(seed))
    expect(reduce(atShelf, { kind: 'confirm' }).tally.served).toBe(0)
  })

  it('banks exact change and moves to the next customer', () => {
    const state = reduce(payExact(changing()), { kind: 'confirm' })
    expect(state.tally.served).toBe(1)
    expect(state.tally.exactChange).toBe(1)
    expect(state.customer.id).toBe(2)
    expect(state.tray).toStrictEqual(EMPTY_PURSE)
    expect(state.phase).toBe('scanning')
  })

  it('flags sloppy-but-correct change', () => {
    let state = changing()
    const owed = changeOwed(state)
    // Correct money, needlessly many pieces: pay the ¥100s in ¥10 coins.
    const hundreds = Math.floor(owed / 100)
    for (let n = 0; n < hundreds * 10; n += 1) {
      state = reduce(state, { kind: 'give', denom: 10 })
    }
    let left = owed - hundreds * 100
    for (const denom of [50, 10, 5, 1] as const) {
      while (left >= denom) {
        state = reduce(state, { kind: 'give', denom })
        left -= denom
      }
    }
    expect(purseValue(state.tray)).toBe(owed)
    const after = reduce(state, { kind: 'confirm' })
    expect(after.tally.exactChange).toBe(1)
    expect(after.tally.sloppyChange).toBe(1)
    expect(after.message).toContain('too many')
  })

  it('will not let you hand over a coin the drawer does not have', () => {
    // The whole point of a finite till: you work with what is in it.
    let state = changing()
    const ones = state.drawer[1]
    for (let n = 0; n < ones; n += 1) {
      state = reduce(state, { kind: 'give', denom: 1 })
    }
    expect(state.drawer[1]).toBe(0)
    // One more is refused outright rather than conjuring a coin.
    const blocked = reduce(state, { kind: 'give', denom: 1 })
    expect(blocked).toStrictEqual(state)
  })

  it('conserves money: every piece in the tray came out of the drawer', () => {
    let state = changing()
    const before = purseValue(state.drawer)
    for (const denom of [500, 100, 100, 10, 1] as const) {
      state = reduce(state, { kind: 'give', denom })
    }
    expect(purseValue(state.drawer) + purseValue(state.tray)).toBe(before)
    // And putting one back is the exact inverse.
    const returned = reduce(state, { kind: 'take-back', denom: 500 })
    expect(purseValue(returned.drawer) + purseValue(returned.tray)).toBe(before)
    expect(returned.drawer[500]).toBe(state.drawer[500] + 1)
  })

  it('takes the customer cash into the drawer at confirm', () => {
    const ready = changing()
    const before = purseValue(ready.drawer)
    const owed = changeOwed(ready)
    const after = reduce(payExact(ready), { kind: 'confirm' })
    // Drawer gained what they paid and lost what was handed back.
    expect(purseValue(after.drawer)).toBe(before + tenderValue(ready.customer) - owed)
  })

  it('penalises wrong change and books the drawer', () => {
    const state = reduce(reduce(changing(), { kind: 'give', denom: 1 }), { kind: 'confirm' })
    expect(state.tally.wrongChange).toBe(1)
    expect(state.tally.drawerDelta).not.toBe(0)
    expect(state.tally.score).toBeLessThan(0)
  })
})
