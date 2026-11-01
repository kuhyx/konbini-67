import { describe, expect, it } from 'vitest'
import { createShift, missingFromBasket, reduce, type ShiftState } from './shift'
import { FULL_SHELF, RESTOCK_MS, RESTOCK_PER_TRIP, SHELF_CAPACITY } from './stock'
import { servePerfectly, changing } from '../test/shift-fixtures'

/**
A shift where the clerk has walked out to the stockroom.
*/
const outBack = (): ShiftState => reduce(createShift(1), { kind: 'look', at: 'stockroom' })

/**
A shift whose first customer wants something the shop has run out of.
*/
const wanting = (): ShiftState => {
  const fresh = createShift(1)
  const [line] = fresh.customer.basket
  if (line === undefined) {
    throw new Error('seed 1 customer should have a basket')
  }
  return { ...fresh, stock: { ...FULL_SHELF, [line.item]: 0 } }
}

describe('restocking', () => {
  it('puts more of an item on the shelf', () => {
    const emptied: ShiftState = { ...outBack(), stock: { ...FULL_SHELF, melonpan: 0 } }
    const after = reduce(emptied, { kind: 'restock', item: 'melonpan' })
    expect(after.stock.melonpan).toBe(RESTOCK_PER_TRIP)
    expect(after.tally.restocked).toBe(1)
  })

  it('costs time you are not at the till', () => {
    // The whole cost of the mechanic: the person at the counter is waiting.
    const emptied: ShiftState = { ...outBack(), stock: { ...FULL_SHELF, melonpan: 0 } }
    const after = reduce(emptied, { kind: 'restock', item: 'melonpan' })
    expect(after.frozenUntilMs).toBe(after.elapsedMs + RESTOCK_MS)
  })

  it('says so rather than wasting a trip on a full shelf', () => {
    const after = reduce(outBack(), { kind: 'restock', item: 'melonpan' })
    expect(after.stock.melonpan).toBe(SHELF_CAPACITY)
    expect(after.tally.restocked).toBe(0)
    expect(after.message).toContain('already full')
  })

  it('only works out back', () => {
    // Walking off to the stockroom is a thing you do *instead* of standing at
    // the counter, so it cannot be done from the counter.
    const atCounter: ShiftState = { ...createShift(1), stock: { ...FULL_SHELF, melonpan: 0 } }
    expect(reduce(atCounter, { kind: 'restock', item: 'melonpan' })).toStrictEqual(atCounter)
  })

  it('cannot be done while frozen', () => {
    const emptied: ShiftState = {
      ...outBack(),
      stock: { ...FULL_SHELF, melonpan: 0 },
      frozenUntilMs: 9_999_999,
    }
    expect(reduce(emptied, { kind: 'restock', item: 'melonpan' })).toStrictEqual(emptied)
  })

  it('cannot be done mid-transaction', () => {
    // Nobody walks out back holding a customer's money.
    const mid: ShiftState = {
      ...changing(),
      gaze: 'stockroom',
      stock: { ...FULL_SHELF, melonpan: 0 },
    }
    expect(reduce(mid, { kind: 'restock', item: 'melonpan' })).toStrictEqual(mid)
  })
})

describe('running out of stock', () => {
  it('knows what the shop cannot supply', () => {
    const state = wanting()
    expect(missingFromBasket(state).length).toBeGreaterThan(0)
  })

  it('sends the customer away and counts the lost sale', () => {
    const before = wanting()
    const after = reduce(before, { kind: 'turn-away' })
    expect(after.tally.lostSales).toBe(1)
    expect(after.message).toContain('we’re out of')
    // They leave, and the next one steps up.
    expect(after.customer.id).toBe(before.customer.id + 1)
  })

  it('takes no money for a sale that never happened', () => {
    const after = reduce(wanting(), { kind: 'turn-away' })
    expect(after.takings).toBe(0)
    expect(after.tally.served).toBe(0)
  })

  it('does nothing when everything wanted is in stock', () => {
    const stocked = createShift(1)
    expect(reduce(stocked, { kind: 'turn-away' })).toStrictEqual(stocked)
  })

  it('depletes the shelf when a sale completes', () => {
    const fresh = createShift(1)
    const [line] = fresh.customer.basket
    if (line === undefined) {
      throw new Error('seed 1 customer should have a basket')
    }
    const sold = servePerfectly(fresh)
    expect(sold.stock[line.item]).toBe(SHELF_CAPACITY - line.qty)
  })
})
