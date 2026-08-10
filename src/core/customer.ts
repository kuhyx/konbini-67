import { CIGARETTE_ORDER, CIGARETTES, ITEM_ORDER, ITEMS } from './catalog'
import { type Denom, DENOMS, EMPTY_PURSE, type Purse } from './money'
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
 * What the customer hands over.
 *
 * Deliberately not exact: people pay with round notes, which is precisely
 * what makes the change interesting. Picks the smallest note that covers the
 * total, then sometimes adds loose coins the way real customers do.
 */
export const makeTender = (rng: Rng, total: number): Purse => {
  const out: Record<Denom, number> = { ...EMPTY_PURSE }
  let note: Denom = 1000
  if (total > 5000) {
    note = 10_000
  } else if (total > 1000) {
    note = 5000
  }
  out[note] = 1
  // Roughly a third of customers dig out coins to round the change off.
  if (nextFloat(rng) < 0.34) {
    const coin = pick(rng, [500, 100, 50, 10] as const)
    out[coin] += 1
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
