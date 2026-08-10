import { CIGARETTE_ORDER, CIGARETTES, ITEM_ORDER, ITEMS } from './catalog'
import { type Denom, DENOMS, EMPTY_PURSE, type Purse } from './money'
import { makeIdCard } from './id-check'
import { nextFloat, nextInt, pick, type Rng } from './rng'
import type { ShelfSpec } from './shelf'
import type { BasketLine, CigaretteRequest, Customer } from './types'

/**
 * Regulars and passers-by. Names are flavour only; M6 gives them memory.
 */
const NAMES = [
  'Salaryman',
  'Student',
  'Night Nurse',
  'Taxi Driver',
  'Construction Guy',
  'Office Lady',
  'Delivery Rider',
  'Old Regular',
] as const

/**
 * Names cycle by customer id rather than being drawn from the rng: two
 * consecutive customers sharing a name reads as a bug even when it is honest
 * chance.
 */
export const nameForId = (id: number): string => {
  let out: string = NAMES[0]
  let seen = 0
  const target = (id - 1) % NAMES.length
  for (const name of NAMES) {
    if (seen === target) {
      out = name
    }
    seen += 1
  }
  return out
}

/**
 * Total yen for a basket.
 */
export const basketTotal = (basket: readonly BasketLine[]): number => {
  let total = 0
  for (const line of basket) {
    total += ITEMS[line.item].price * line.qty
  }
  return total
}

/**
 * How a customer chooses to pay.
 *
 * This table is load-bearing, not flavour. When every customer paid with one
 * round note, the drawer became a one-way ratchet: it filled with ¥5,000 notes
 * and bled ¥1,000/¥100/¥10 until it could not make change at all — measured at
 * twenty customers, ¥5,000 went 1 → +21 while ¥1,000 hit −55 and ¥100 −60,
 * with ¥1,000 running dry by the second customer. Real customers vary, and
 * that variety is what keeps a real till solvent.
 */
export type PaymentStyle =
  /**
   * Counts out the exact amount.
   */
  | 'exact'
  /**
   * Exact notes, then digs for coins so the change comes back round.
   */
  | 'near-exact'
  /**
   * One note that covers it, nothing else.
   */
  | 'one-note'
  /**
   * Several smaller notes rather than one big one.
   */
  | 'small-notes'
  /**
   * A handful: a note plus whatever coins are in the pocket.
   */
  | 'scatter'

export const PAYMENT_STYLE_ORDER = [
  'exact',
  'near-exact',
  'one-note',
  'small-notes',
  'scatter',
] as const satisfies readonly PaymentStyle[]

/**
 * Cumulative upper bound for each style, walked in `PAYMENT_STYLE_ORDER`.
 *
 * Weighted toward the styles that put small money *into* the drawer, because
 * that is what the change-making then spends back out. `scatter` closes the
 * range at 1 so the walk always terminates on a real style — no unreachable
 * fallback arm.
 */
const STYLE_CEILING: Record<PaymentStyle, number> = {
  exact: 0.2,
  'near-exact': 0.45,
  'one-note': 0.65,
  'small-notes': 0.85,
  scatter: 1,
}

/**
 * Picks a payment style from the generator.
 */
export const pickPaymentStyle = (rng: Rng): PaymentStyle => {
  const roll = nextFloat(rng)
  let chosen: PaymentStyle = 'scatter'
  for (const style of PAYMENT_STYLE_ORDER) {
    if (roll < STYLE_CEILING[style]) {
      chosen = style
      break
    }
  }
  return chosen
}

/**
 * Adds `count` pieces of one denomination to a purse.
 */
const addDenoms = (purse: Purse, denom: Denom, count: number): Purse => ({
  ...purse,
  [denom]: purse[denom] + count,
})

/**
 * The smallest single note that covers `total`.
 */
const coveringNote = (total: number): Denom => {
  if (total > 5000) {
    return 10_000
  }
  if (total > 1000) {
    return 5000
  }
  return 1000
}

/**
 * Counts out `amount` exactly, largest pieces first.
 */
const exactly = (amount: number): Record<Denom, number> => {
  const out: Record<Denom, number> = { ...EMPTY_PURSE }
  let left = amount
  for (const denom of DENOMS) {
    out[denom] = Math.floor(left / denom)
    left %= denom
  }
  return out
}

/**
 * What the customer hands over, according to how they pay.
 *
 * Never less than the total — a purse that could not cover the bill would be a
 * different mechanic (a declined sale) rather than a change-making problem.
 */
export const makeTender = (rng: Rng, total: number, style?: PaymentStyle): Purse => {
  const chosen = style ?? pickPaymentStyle(rng)
  if (chosen === 'exact') {
    return exactly(total)
  }
  if (chosen === 'near-exact') {
    // Rounds up to the next ¥100 and hands that over: the classic "here, I
    // have the coins" move, which returns round change and feeds the drawer.
    const rounded = Math.ceil(total / 100) * 100
    return exactly(rounded)
  }
  if (chosen === 'small-notes') {
    // Pays in ¥1,000 notes rather than reaching for a big one.
    return addDenoms(EMPTY_PURSE, 1000, Math.max(1, Math.ceil(total / 1000)))
  }
  let out = addDenoms(EMPTY_PURSE, coveringNote(total), 1)
  if (chosen === 'scatter') {
    // A note plus a pocketful of coins.
    const coins = 1 + nextInt(rng, 3)
    for (let n = 0; n < coins; n += 1) {
      out = addDenoms(out, pick(rng, [500, 100, 50, 10] as const), 1)
    }
  }
  return out
}

/**
 * Generates one seeded customer for a shift.
 */
export const makeCustomer = (rng: Rng, id: number, shelf: ShelfSpec): Customer => {
  const lineCount = 1 + nextInt(rng, 3)
  const basket: BasketLine[] = []
  for (let n = 0; n < lineCount; n += 1) {
    basket.push({ item: pick(rng, ITEM_ORDER), qty: 1 + nextInt(rng, 2) })
  }

  // Roughly two customers in five ask for cigarettes.
  let cigarette: CigaretteRequest | undefined
  if (nextFloat(rng) < 0.4) {
    const brand = pick(rng, CIGARETTE_ORDER)
    const form = nextFloat(rng) < shelf.byNumberWeight ? 'by-number' : 'by-brand'
    cigarette = { cigarette: brand, form }
  }

  const total = basketTotal(basket) + (cigarette ? CIGARETTES[cigarette.cigarette].price : 0)

  return {
    id,
    name: nameForId(id),
    basket,
    tender: makeTender(rng, total),
    cigarette,
    idCard: makeIdCard(rng),
  }
}

/**
 * What the customer owes, cigarettes included.
 */
export const customerTotal = (customer: Customer): number =>
  basketTotal(customer.basket) +
  (customer.cigarette ? CIGARETTES[customer.cigarette.cigarette].price : 0)

/**
 * Yen value of what the customer handed over.
 */
export const tenderValue = (customer: Customer): number => {
  let total = 0
  for (const denom of DENOMS) {
    total += denom * customer.tender[denom]
  }
  return total
}
