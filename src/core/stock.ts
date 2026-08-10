/**
 * Shelf stock: what the shop has left to sell, and the work of putting more out.
 *
 * This is the first mechanic that gives the gaps between customers a cost.
 * Everything up to now happens while somebody is standing at the counter;
 * standing idle was free. A shelf that empties turns quiet moments into a
 * choice — restock now, or serve the next customer and hope the one after
 * that does not want the thing you never put out.
 *
 * The rule that shapes the design: **you cannot sell what is not on the
 * shelf.** A customer whose basket needs an out-of-stock item is a sale you
 * lose to your own housekeeping, which is the honest konbini failure mode.
 */

import { ITEM_ORDER, type ItemId } from './catalog'

/**
 * How many of each item a full shelf holds.
 *
 * One number for every item rather than a per-item capacity: the interesting
 * decision is *which* shelf to refill under time pressure, and per-item
 * capacities would make that a lookup rather than a judgement.
 */
export const SHELF_CAPACITY = 6

/**
 * What one restocking trip puts out.
 *
 * Deliberately less than a full shelf. A trip that completely solves the
 * problem makes restocking a chore you do once; a partial one means you are
 * always trading "enough for now" against time at the counter.
 */
export const RESTOCK_PER_TRIP = 3

/**
 * Milliseconds a restocking trip takes.
 *
 * The whole cost of the mechanic. It is time you are not at the till, and the
 * customer waiting is what makes it hurt — see the patience rules.
 */
export const RESTOCK_MS = 4000

/**
 * How much of each item is on the shelf.
 */
export type Stock = Readonly<Record<ItemId, number>>

/**
 * A full shelf of everything, which is how a shift opens.
 */
export const FULL_SHELF: Stock = Object.fromEntries(
  ITEM_ORDER.map((id) => [id, SHELF_CAPACITY]),
) as Stock

/**
 * Whether an item can be sold at all.
 */
export const isInStock = (stock: Stock, id: ItemId): boolean => stock[id] > 0

/**
 * Everything that has run out, in catalog order.
 *
 * Ordered rather than a set so the UI renders the same list every time: a
 * restock button that moves around under the cursor is its own small cruelty.
 */
export const emptyShelves = (stock: Stock): readonly ItemId[] =>
  ITEM_ORDER.filter((id) => stock[id] === 0)

/**
 * Anything not full, which is what a restocking trip can usefully target.
 */
export const needsRestocking = (stock: Stock): readonly ItemId[] =>
  ITEM_ORDER.filter((id) => stock[id] < SHELF_CAPACITY)

/**
 * Takes one item off the shelf.
 *
 * Selling below zero is impossible rather than merely discouraged: the count
 * is the authority on what exists, and a negative shelf would mean the shop
 * sold something it never had.
 */
export const takeFromShelf = (stock: Stock, id: ItemId): Stock =>
  stock[id] === 0 ? stock : { ...stock, [id]: stock[id] - 1 }

/**
 * Puts `RESTOCK_PER_TRIP` of one item back, never past capacity.
 */
export const restock = (stock: Stock, id: ItemId): Stock => ({
  ...stock,
  [id]: Math.min(SHELF_CAPACITY, stock[id] + RESTOCK_PER_TRIP),
})

/**
 * The items in a basket that the shop cannot actually supply.
 *
 * Returned as a list rather than a boolean because the clerk has to be told
 * *what* is missing — "we are out of the katsu bento" is a thing you say to a
 * customer, "this basket is unfulfillable" is not.
 */
export const outOfStockIn = (stock: Stock, wanted: readonly ItemId[]): readonly ItemId[] =>
  ITEM_ORDER.filter((id) => wanted.includes(id) && !isInStock(stock, id))
