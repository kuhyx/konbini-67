import { describe, expect, it } from 'vitest'
import { ITEM_ORDER } from './catalog'
import {
  emptyShelves,
  FULL_SHELF,
  isInStock,
  needsRestocking,
  outOfStockIn,
  RESTOCK_PER_TRIP,
  restock,
  SHELF_CAPACITY,
  type Stock,
  takeFromShelf,
} from './stock'

const emptied = (id: (typeof ITEM_ORDER)[number]): Stock => ({ ...FULL_SHELF, [id]: 0 })

describe('FULL_SHELF', () => {
  it('stocks every item in the catalog', () => {
    expect(Object.keys(FULL_SHELF).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
      [...ITEM_ORDER].toSorted((a, b) => a.localeCompare(b)),
    )
    expect(Object.values(FULL_SHELF).every((n) => n === SHELF_CAPACITY)).toBe(true)
  })
})

describe('takeFromShelf', () => {
  it('removes one', () => {
    expect(takeFromShelf(FULL_SHELF, 'melonpan').melonpan).toBe(SHELF_CAPACITY - 1)
  })

  it('cannot sell what is not there', () => {
    // The count is the authority on what exists; a negative shelf would mean
    // the shop sold something it never had.
    const empty = emptied('melonpan')
    expect(takeFromShelf(empty, 'melonpan').melonpan).toBe(0)
  })

  it('leaves the object untouched when nothing can be taken', () => {
    const empty = emptied('melonpan')
    expect(takeFromShelf(empty, 'melonpan')).toBe(empty)
  })

  it('does not disturb other shelves', () => {
    const after = takeFromShelf(FULL_SHELF, 'melonpan')
    expect(after.beer).toBe(SHELF_CAPACITY)
  })
})

describe('restock', () => {
  it('puts out a trip’s worth', () => {
    expect(restock(emptied('beer'), 'beer').beer).toBe(RESTOCK_PER_TRIP)
  })

  it('never overfills', () => {
    expect(restock(FULL_SHELF, 'beer').beer).toBe(SHELF_CAPACITY)
  })

  it('tops up a partial shelf without exceeding capacity', () => {
    const low: Stock = { ...FULL_SHELF, beer: SHELF_CAPACITY - 1 }
    expect(restock(low, 'beer').beer).toBe(SHELF_CAPACITY)
  })
})

describe('inStock', () => {
  it('is false only at zero', () => {
    expect(isInStock(FULL_SHELF, 'pocky')).toBe(true)
    expect(isInStock(emptied('pocky'), 'pocky')).toBe(false)
  })
})

describe('emptyShelves', () => {
  it('is empty for a full shop', () => {
    expect(emptyShelves(FULL_SHELF)).toStrictEqual([])
  })

  it('lists what has run out, in catalog order', () => {
    // A restock control that moves around under the cursor between renders is
    // its own small cruelty, so the order has to be stable.
    const stock: Stock = { ...FULL_SHELF, beer: 0, melonpan: 0 }
    const listed = emptyShelves(stock)
    expect(new Set(listed)).toStrictEqual(new Set(['beer', 'melonpan']))
    expect([...listed]).toStrictEqual(ITEM_ORDER.filter((id) => listed.includes(id)))
  })
})

describe('needsRestocking', () => {
  it('is empty for a full shop', () => {
    expect(needsRestocking(FULL_SHELF)).toStrictEqual([])
  })

  it('includes anything below capacity, not just empties', () => {
    const stock: Stock = { ...FULL_SHELF, beer: 0, pocky: SHELF_CAPACITY - 1 }
    expect(new Set(needsRestocking(stock))).toStrictEqual(new Set(['beer', 'pocky']))
  })
})

describe('outOfStockIn', () => {
  it('names what the shop cannot supply', () => {
    // The clerk has to be told *what* is missing: "we are out of the katsu
    // bento" is a thing you say to a customer.
    expect(outOfStockIn(emptied('bento-katsu'), ['bento-katsu', 'pocky'])).toStrictEqual([
      'bento-katsu',
    ])
  })

  it('is empty when everything wanted is on the shelf', () => {
    expect(outOfStockIn(FULL_SHELF, ['pocky', 'beer'])).toStrictEqual([])
  })

  it('ignores empty shelves nobody asked for', () => {
    expect(outOfStockIn(emptied('umbrella'), ['pocky'])).toStrictEqual([])
  })
})
