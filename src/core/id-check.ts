/**
 * Age verification.
 *
 * Japanese konbini tills prompt for an age confirmation on beer and tobacco,
 * and the clerk is the one who decides whether to press it. Most customers are
 * obviously old enough and the whole thing takes a second; occasionally one is
 * not, and occasionally one takes offence at being asked. Both of those are
 * the interesting cases.
 */

import { ITEMS } from './catalog'
import { nextFloat, nextInt, type Rng } from './rng'
import type { Customer } from './types'

/**
 * The legal age for beer and tobacco in Japan.
 */
export const LEGAL_AGE = 20

/**
 * What the customer produces when asked.
 */
export type IdOutcome =
  /**
   * Shows a valid card. Over the line.
   */
  | 'valid'
  /**
   * Shows a card that puts them under age.
   */
  | 'underage'
  /**
   * Has not got one on them.
   */
  | 'none'
  /**
   * Has one, but it expired.
   */
  | 'expired'

export const ID_OUTCOME_ORDER = ['valid', 'underage', 'none', 'expired'] as const

/**
 * Whether it is legal to sell to someone with this outcome.
 */
export const isSaleLegal = (outcome: IdOutcome): boolean => outcome === 'valid'

/**
 * What a customer is carrying, decided from the shift generator.
 */
export interface IdCard {
  readonly outcome: IdOutcome
  /**
   * The age printed on the card, when there is one to read.
   */
  readonly age: number
  /**
   * Whether they will argue about being asked at all.
   *
   * Being asked when you are visibly forty is annoying, and some people say
   * so. Arguing is not the same as being underage.
   */
  readonly willArgue: boolean
}

/**
 * Whether this customer's basket needs an age check.
 *
 * Cigarettes always do; beer and anything else flagged in the item table does
 * too.
 */
export const requiresIdCheck = (customer: Customer): boolean => {
  if (customer.cigarette !== undefined) {
    return true
  }
  for (const line of customer.basket) {
    if (ITEMS[line.item].ageRestricted) {
      return true
    }
  }
  return false
}

/**
 * Rolls a customer's ID.
 *
 * Weighted heavily toward "valid", because almost everyone buying a beer at a
 * konbini is plainly an adult — the point of the mechanic is that the rare
 * exception is buried in a stream of routine ones, so you cannot stop looking.
 */
export const makeIdCard = (rng: Rng): IdCard => {
  const roll = nextFloat(rng)
  const willArgue = nextFloat(rng) < 0.2
  if (roll < 0.8) {
    return { outcome: 'valid', age: LEGAL_AGE + 2 + nextInt(rng, 40), willArgue }
  }
  if (roll < 0.9) {
    return { outcome: 'underage', age: 15 + nextInt(rng, LEGAL_AGE - 15), willArgue }
  }
  if (roll < 0.95) {
    return { outcome: 'none', age: 0, willArgue }
  }
  return { outcome: 'expired', age: LEGAL_AGE + 1 + nextInt(rng, 20), willArgue }
}

/**
 * How long asking for ID takes.
 */
export const ID_CHECK_MS = 3000

/**
 * What the clerk sees when they look at the card.
 *
 * States the facts and nothing else: reading them is the player's job, the
 * same as counting the change.
 */
export const describeId = (card: IdCard): string => {
  if (card.outcome === 'none') {
    return 'They have not got it on them.'
  }
  if (card.outcome === 'expired') {
    return `The card expired last year. Born ${String(card.age)} years ago.`
  }
  return `The card says ${String(card.age)}.`
}

/**
 * Scoring for the call the clerk made.
 *
 * Selling to someone underage is the one genuinely serious mistake in the
 * game — a real clerk loses the shop its licence — so it costs far more than
 * any change error. Refusing correctly is the job, and is rewarded as such.
 * Refusing someone who was fine is a smaller error: irritating, not illegal.
 */
export const ID_SCORE = {
  soldLegally: 40,
  refusedCorrectly: 80,
  soldUnderage: -400,
  refusedWrongly: -60,
  /**
   * Skipping the check entirely on a basket that needed one. Getting away
   * with it is not the same as doing it right.
   */
  skippedCheck: -150,
} as const

/**
 * Points for how an age-restricted sale was handled.
 */
export const idCheckPoints = (outcome: IdOutcome, didSell: boolean): number => {
  const isLegal = isSaleLegal(outcome)
  if (didSell) {
    return isLegal ? ID_SCORE.soldLegally : ID_SCORE.soldUnderage
  }
  return isLegal ? ID_SCORE.refusedWrongly : ID_SCORE.refusedCorrectly
}
