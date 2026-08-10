import { CIGARETTE_ORDER, CIGARETTES, ITEM_ORDER, ITEMS } from './catalog'
import {
  type Denom,
  DENOMS,
  EMPTY_PURSE,
  greedyChange,
  mergePurses,
  optimalCount,
  type Purse,
  purseCount,
} from './money'
import { makeIdCard } from './id-check'
import { createRng, nextFloat, nextInt, pick, type Rng } from './rng'
import type { ShelfSpec } from './shelf'
import {
  type BasketLine,
  type CigaretteRequest,
  type Customer,
  type PaymentStyle,
  PAYMENT_STYLE_ORDER,
} from './types'

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
export const coveringNote = (total: number): Denom => {
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
  const note = coveringNote(total)
  let out = addDenoms(EMPTY_PURSE, note, 1)
  if (chosen === 'scatter') {
    // A note plus coins — but only coins that pay for themselves. Real people
    // dig out change to end up holding *fewer* pieces ("¥1,202? here's the ¥2",
    // which turns ¥3,798 of shrapnel into ¥3,800), not to satisfy an
    // arithmetic identity. Handing over ¥67 in five coins to avoid receiving
    // ¥33 in four is a worse deal than not bothering, and paying ¥67 on top of
    // a ¥5,000 note that already covers the bill is something nobody does.
    //
    // So the rule is the one a person actually applies at a till: count out the
    // sub-¥100 remainder only if those coins cost less than the shrapnel they
    // save. Otherwise hand over the bare note.
    const remainder = total % 100
    const dug = greedyChange(remainder)
    const saved = optimalCount(note - total) - optimalCount(note - total + remainder)
    if (purseCount(dug) < saved) {
      out = mergePurses(out, dug)
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
  // Rather more than half are actually listening when you say the price.
  const willQueryThePrice = nextFloat(rng) < 0.6

  return {
    id,
    name: nameForId(id),
    basket,
    tender: makeTender(rng, total),
    style: pickPaymentStyle(rng),
    willQueryThePrice,
    cigarette,
    idCard: makeIdCard(rng),
  }
}

/**
 * What the customer hands over against a quoted price.
 *
 * They pay what they were *told*, not what the till says — so a misquote that
 * goes unnoticed changes the money on the counter, and therefore the change,
 * and therefore the books. Their payment style is fixed when they walk in, so
 * quoting the same number twice always produces the same handful.
 */
export const tenderFor = (customer: Customer, quoted: number): Purse =>
  makeTender(createRng(customer.id), Math.max(0, quoted), customer.style)

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
