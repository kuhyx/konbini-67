import { describe, expect, it } from 'vitest'
import { CIGARETTES } from './catalog'
import { basketTotal, customerTotal, makeCustomer, makeTender, nameForId, tenderValue } from './customer'
import { purseValue } from './money'
import { createRng } from './rng'
import { type ShelfSpec, shelfSpecForShift } from './shelf'
import type { CigaretteRequest, Customer } from './types'

const shelf = shelfSpecForShift(1)

/**
 * Number of seeds to try when looking for a customer of a given shape.
 *
 * Cigarette requests land on roughly two customers in five, so a miss across
 * this many seeds means the generator is broken, not unlucky.
 */
const SEED_SEARCH_LIMIT = 60

/**
 * First customer within the seed budget matching `isMatch`.
 *
 * Throws rather than returning undefined so callers assert on a real customer
 * unconditionally, instead of wrapping every assertion in an `if` that would
 * silently pass when nothing matched.
 */
const findCustomer = <T extends Customer>(
  spec: ShelfSpec,
  isMatch: (customer: Customer) => customer is T,
): T => {
  for (let seed = 0; seed < SEED_SEARCH_LIMIT; seed += 1) {
    const customer = makeCustomer(createRng(seed), 1, spec)
    if (isMatch(customer)) {
      return customer
    }
  }
  throw new Error(`no matching customer in ${String(SEED_SEARCH_LIMIT)} seeds`)
}

/**
 * A customer carrying a cigarette request, so the request can be indexed
 * without re-checking for undefined at every use.
 */
type Smoker = Customer & { readonly cigarette: CigaretteRequest }

/**
 * A customer who asked for nothing behind the counter.
 */
type NonSmoker = Customer & { readonly cigarette: undefined }

const isSmoker = (customer: Customer): customer is Smoker =>
  customer.cigarette !== undefined

const isNonSmoker = (customer: Customer): customer is NonSmoker =>
  customer.cigarette === undefined

describe('nameForId', () => {
  it('never repeats for consecutive customers', () => {
    for (let id = 1; id < 40; id += 1) {
      expect(nameForId(id)).not.toBe(nameForId(id + 1))
    }
  })

  it('cycles back around', () => {
    expect(nameForId(1)).toBe(nameForId(9))
  })
})

describe('makeTender', () => {
  it('always covers the bill', () => {
    for (let total = 1; total < 9000; total += 37) {
      const rng = createRng(total)
      expect(purseValue(makeTender(rng, total))).toBeGreaterThanOrEqual(total)
    }
  })

  it('reaches for a bigger note as the bill grows', () => {
    expect(makeTender(createRng(1), 500)[1000]).toBe(1)
    expect(makeTender(createRng(1), 2000)[5000]).toBe(1)
    expect(makeTender(createRng(1), 6000)[10_000]).toBe(1)
  })

  it('sometimes adds loose coins and sometimes does not', () => {
    let withCoins = 0
    let withoutCoins = 0
    for (let seed = 0; seed < 60; seed += 1) {
      const purse = makeTender(createRng(seed), 500)
      if (purseValue(purse) > 1000) {
        withCoins += 1
      } else {
        withoutCoins += 1
      }
    }
    // Both branches must actually occur, or the coin path is untested.
    expect(withCoins).toBeGreaterThan(0)
    expect(withoutCoins).toBeGreaterThan(0)
  })
})

describe('makeCustomer', () => {
  it('is deterministic for a seed', () => {
    const a = makeCustomer(createRng(5), 1, shelf)
    const b = makeCustomer(createRng(5), 1, shelf)
    expect(a).toStrictEqual(b)
  })

  it('always gives a non-empty basket', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const customer = makeCustomer(createRng(seed), 1, shelf)
      expect(customer.basket.length).toBeGreaterThan(0)
      expect(basketTotal(customer.basket)).toBeGreaterThan(0)
    }
  })

  it('produces both cigarette and non-cigarette customers', () => {
    let withCigs = 0
    let withoutCigs = 0
    for (let seed = 0; seed < 60; seed += 1) {
      if (makeCustomer(createRng(seed), 1, shelf).cigarette === undefined) {
        withoutCigs += 1
      } else {
        withCigs += 1
      }
    }
    expect(withCigs).toBeGreaterThan(0)
    expect(withoutCigs).toBeGreaterThan(0)
  })

  it('produces both request forms across the tiers', () => {
    const forms = new Set<string>()
    for (const tier of [1, 7]) {
      const spec = shelfSpecForShift(tier)
      for (let seed = 0; seed < 60; seed += 1) {
        const cigarette = makeCustomer(createRng(seed), 1, spec).cigarette
        if (cigarette !== undefined) {
          forms.add(cigarette.form)
        }
      }
    }
    expect(forms).toStrictEqual(new Set(['by-number', 'by-brand']))
  })

  it('adds the cigarette price to the total', () => {
    const customer = findCustomer(shelf, isSmoker)
    expect(customerTotal(customer)).toBe(
      basketTotal(customer.basket) + CIGARETTES[customer.cigarette.cigarette].price,
    )
  })

  it('totals a cigarette-free customer as just the basket', () => {
    const customer = findCustomer(shelf, isNonSmoker)
    expect(customer.cigarette).toBeUndefined()
    expect(customerTotal(customer)).toBe(basketTotal(customer.basket))
  })

  it('always hands over at least the total', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const customer = makeCustomer(createRng(seed), 1, shelf)
      expect(tenderValue(customer)).toBeGreaterThanOrEqual(customerTotal(customer))
    }
  })
})
