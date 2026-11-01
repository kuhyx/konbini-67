/**
Opening a shift: laying out the counter and the first customer.
*/

import type { CounterThing } from './catalog'
import { makeCustomer } from './customer'
import { type Denom, DENOMS, EMPTY_PURSE, OPENING_FLOAT, type Purse } from './money'
import { type Placed, scatter } from './layout'
import { MESS_INTERVAL_MS } from './mess'
import { createRng, type Rng } from './rng'
import { shelfSpecForShift } from './shelf'
import { FULL_SHELF } from './stock'
import { EMPTY_TALLY, type Customer } from './types'
import type { ShiftState } from './shift-state'

/**
Where the customer's goods land when they put the basket down.
*/
export const GOODS_AREA = { x: 0.05, y: 0.1, width: 0.35, height: 0.8 }

/**
Where the customer drops their money — their side of the counter.
*/
export const CASH_AREA = { x: 0.62, y: 0.12, width: 0.32, height: 0.45 }

/**
Where a packet fetched from the cigarette wall lands: your side of the
beam, so it still has to be passed over like everything else.
*/
export const PACKET_AREA = { x: 0.08, y: 0.62, width: 0.22, height: 0.2 }

/**
Spreads a purse out as individual coins and notes.
*/
export const layOutCash = (rng: Rng, purse: Purse): readonly Placed<Denom>[] => {
  const loose: Denom[] = []
  for (const denom of DENOMS) {
    for (let n = 0; n < purse[denom]; n += 1) {
      loose.push(denom)
    }
  }
  return scatter(rng, loose, CASH_AREA)
}

/**
Lays a basket out on the counter, one loose item per unit of quantity.
*/
export const layOutBasket = (rng: Rng, customer: Customer): readonly Placed<CounterThing>[] => {
  const loose: CounterThing[] = []
  for (const line of customer.basket) {
    for (let n = 0; n < line.qty; n += 1) {
      loose.push({ kind: 'item', id: line.item })
    }
  }
  return scatter(rng, loose, GOODS_AREA)
}

/**
Total items the current customer wants rung up.

The cigarette packet counts: once fetched it lies on the counter and has to
go over the beam like anything else.
*/
export const lineCount = (customer: Customer): number => {
  let count = customer.cigarette === undefined ? 0 : 1
  for (const line of customer.basket) {
    count += line.qty
  }
  return count
}

/**
Items rung up before the cigarette request interrupts.

The packet is not on the counter until it has been fetched, so the scanning
phase pauses one short of the full count. Only ever asked about a customer
who wants cigarettes, hence the unconditional subtraction.
*/
export const basketCount = (customer: Customer): number => lineCount(customer) - 1

/**
Starts a shift. `shift` is 1-based and drives the shelf escalation.

`float` is the drawer it opens with — injectable so a test can start from a
till that cannot make change, which is otherwise reachable only by playing
a long way into a shift.
*/
export const createShift = (seed: number, shift = 1, float: Purse = OPENING_FLOAT): ShiftState => {
  const rng = createRng(seed)
  const shelf = shelfSpecForShift(shift)
  const customer = makeCustomer(rng, 1, shelf)
  return {
    phase: 'scanning',
    shift,
    shelf,
    rng,
    customer,
    onCounter: layOutBasket(rng, customer),
    // Nothing yet: they pay once they have been told the price.
    cashOnCounter: [],
    tray: EMPTY_PURSE,
    quoted: undefined,
    scanned: 0,
    shelfDone: false,
    gaze: 'counter',
    idShown: undefined,
    drawer: float,
    drawerAtTender: float,
    openingFloat: float,
    takings: 0,
    elapsedMs: 0,
    customerStartMs: 0,
    frozenUntilMs: 0,
    tally: EMPTY_TALLY,
    stock: FULL_SHELF,
    messes: [],
    nextMessId: 1,
    nextMessAtMs: MESS_INTERVAL_MS,
    forgivenMs: 0,
    hotCase: [],
    nextCookId: 1,
    message: 'Ring up the items.',
  }
}
