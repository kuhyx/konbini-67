import { describe, expect, it } from 'vitest'
import { makeCustomer } from './customer'
import {
  describeId,
  ID_OUTCOME_ORDER,
  ID_SCORE,
  idCheckPoints,
  isSaleLegal,
  LEGAL_AGE,
  makeIdCard,
  requiresIdCheck,
} from './id-check'
import { createRng } from './rng'
import { shelfSpecForShift } from './shelf'
import type { Customer } from './types'

const shelf = shelfSpecForShift(1)

/**
 * First customer within the seed budget matching a predicate.
 */
const findCustomer = (isMatch: (customer: Customer) => boolean): Customer => {
  for (let seed = 0; seed < 200; seed += 1) {
    const customer = makeCustomer(createRng(seed), 1, shelf)
    if (isMatch(customer)) {
      return customer
    }
  }
  throw new Error('no matching customer in 200 seeds')
}

describe('requiresIdCheck', () => {
  it('is true for anyone buying cigarettes', () => {
    expect(requiresIdCheck(findCustomer((c) => c.cigarette !== undefined))).toBe(true)
  })

  it('is true for a basket holding beer', () => {
    const withBeer = findCustomer((c) => c.basket.some((line) => line.item === 'beer'))
    expect(requiresIdCheck(withBeer)).toBe(true)
  })

  it('is false for an ordinary basket with no cigarettes', () => {
    const plain = findCustomer(
      (c) => c.cigarette === undefined && c.basket.every((line) => line.item !== 'beer'),
    )
    expect(requiresIdCheck(plain)).toBe(false)
  })
})

describe('makeIdCard', () => {
  it('is deterministic for a seed', () => {
    expect(makeIdCard(createRng(7))).toStrictEqual(makeIdCard(createRng(7)))
  })

  it('produces every outcome across enough seeds', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 400; seed += 1) {
      seen.add(makeIdCard(createRng(seed)).outcome)
    }
    expect(seen).toStrictEqual(new Set(ID_OUTCOME_ORDER))
  })

  it('mostly produces valid ID, because most customers are plainly adults', () => {
    let valid = 0
    for (let seed = 0; seed < 400; seed += 1) {
      if (makeIdCard(createRng(seed)).outcome === 'valid') {
        valid += 1
      }
    }
    expect(valid).toBeGreaterThan(280)
  })

  it('gives valid cards an age over the line and underage ones below it', () => {
    const cards = Array.from({ length: 300 }, (_, seed) => makeIdCard(createRng(seed)))
    const validAges = cards.filter((c) => c.outcome === 'valid').map((c) => c.age)
    const underageAges = cards.filter((c) => c.outcome === 'underage').map((c) => c.age)
    expect(validAges.every((age) => age >= LEGAL_AGE)).toBe(true)
    expect(underageAges.every((age) => age < LEGAL_AGE)).toBe(true)
    expect(validAges.length).toBeGreaterThan(0)
    expect(underageAges.length).toBeGreaterThan(0)
  })

  it('makes some customers argue about being asked', () => {
    let arguers = 0
    for (let seed = 0; seed < 300; seed += 1) {
      if (makeIdCard(createRng(seed)).willArgue) {
        arguers += 1
      }
    }
    expect(arguers).toBeGreaterThan(0)
    expect(arguers).toBeLessThan(300)
  })
})

describe('isSaleLegal', () => {
  it('is true only for a valid card', () => {
    for (const outcome of ID_OUTCOME_ORDER) {
      expect(isSaleLegal(outcome)).toBe(outcome === 'valid')
    }
  })
})

describe('describeId', () => {
  it('states the facts without making the call for you', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const card = makeIdCard(createRng(seed))
      const text = describeId(card)
      expect(text.length).toBeGreaterThan(0)
      // Never tells the player what to do.
      expect(text).not.toMatch(/refuse|sell|legal|illegal/i)
    }
  })

  it('says so when there is no card at all', () => {
    let seed = 0
    while (makeIdCard(createRng(seed)).outcome !== 'none') {
      seed += 1
    }
    const card = makeIdCard(createRng(seed))
    expect(describeId(card)).toMatch(/not got it/)
  })

  it('says so when the card has expired', () => {
    let seed = 0
    while (makeIdCard(createRng(seed)).outcome !== 'expired') {
      seed += 1
    }
    const card = makeIdCard(createRng(seed))
    expect(describeId(card)).toMatch(/expired/)
  })
})

describe('idCheckPoints', () => {
  it('makes selling underage by far the worst thing you can do', () => {
    expect(idCheckPoints('underage', true)).toBe(ID_SCORE.soldUnderage)
    expect(ID_SCORE.soldUnderage).toBeLessThan(ID_SCORE.refusedWrongly)
  })

  it('rewards refusing anyone who cannot prove their age', () => {
    for (const outcome of ['underage', 'none', 'expired'] as const) {
      expect(idCheckPoints(outcome, false)).toBe(ID_SCORE.refusedCorrectly)
    }
  })

  it('rewards a legal sale and charges a little for a wrong refusal', () => {
    expect(idCheckPoints('valid', true)).toBe(ID_SCORE.soldLegally)
    expect(idCheckPoints('valid', false)).toBe(ID_SCORE.refusedWrongly)
  })
})
