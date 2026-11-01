/**
Event arms that close a sale: ID checks, refusals, lost sales and the confirm.
*/

import { ITEMS, type ItemId } from './catalog'
import { customerTotal } from './customer'
import { formatYen, mergePurses } from './money'
import {
  describeId,
  ID_CHECK_MS,
  ID_SCORE,
  idCheckPoints,
  isSaleLegal,
  requiresIdCheck,
} from './id-check'
import { type ChangeGrade, gradeChange, parMs, speedPoints } from './score'
import { outOfStockIn, takeFromShelf } from './stock'
import type { ShiftTally } from './types'
import type { ShiftState } from './shift-state'
import { lineCount } from './shift-setup'
import { advance, canTender, changeOwed, paidPurse, quotedPrice } from './shift-queries'

/**
Feedback line for a graded transaction.

A wrong total is not one mistake but two, and they behave nothing alike:

- **Short-changed the customer** (`drawerDelta > 0`). They count it, they
  notice, they say so. You are told the amount because they would tell you.
- **Overpaid the customer** (`drawerDelta < 0`). Nobody in the history of
  retail has handed money back. The customer leaves happy and the *shop* is
  short — which is why it surfaces silently here and lands in the books at
  the end of the shift rather than being announced at the counter.
*/
export const confirmMessage = (grade: ChangeGrade): string => {
  if (grade.drawerDelta > 0) {
    return `You're ${formatYen(grade.drawerDelta)} short. They counted it.`
  }
  if (grade.drawerDelta < 0) {
    return `They took it and left. The drawer is ${formatYen(-grade.drawerDelta)} down.`
  }
  return grade.surplusCoins > 0
    ? `Right, but ${String(grade.surplusCoins)} coin(s) too many.`
    : 'Exact. Next.'
}

/**
Asks to see some ID.

Costs a couple of seconds and, for the one customer in five who takes
offence, a moment of being told off. Asking is never the wrong call — the
argument is noise, not a signal.
*/
export const onAskId = (state: ShiftState): ShiftState => {
  if (state.idShown !== undefined) {
    return state
  }
  const card = state.customer.idCard
  const line = card.willArgue
    ? '“Seriously? Do I look under twenty?” They hand it over anyway.'
    : 'They hand it over.'
  return {
    ...state,
    idShown: card.outcome,
    elapsedMs: state.elapsedMs + ID_CHECK_MS,
    message: `${line} ${describeId(card)}`,
  }
}

/**
Turns the sale down.

The right call for anyone who cannot prove their age, and the wrong one for
anyone who can — but the clerk has to decide which, which is the mechanic.
*/
export const onRefuseSale = (state: ShiftState): ShiftState => {
  const outcome = state.idShown ?? state.customer.idCard.outcome
  const points = idCheckPoints(outcome, false)
  const tally: ShiftTally = {
    ...state.tally,
    served: state.tally.served + 1,
    score: state.tally.score + points,
  }
  const message = isSaleLegal(outcome)
    ? 'They were old enough. They leave without their shopping.'
    : 'You turn them down. They mutter, and go.'
  return advance(state, tally, message)
}

/**
What the current customer wants that the shop has not got.
*/
export const missingFromBasket = (state: ShiftState): readonly ItemId[] =>
  outOfStockIn(
    state.stock,
    state.customer.basket.map((line) => line.item),
  )

/**
Send away a customer whose basket the shop cannot fill.

There is no scored penalty beyond the lost sale itself, in keeping with the
no-scoreboard rule: the shop simply took no money from someone who wanted to
give it some, and that shows up in the takings.
*/
export const onLostSale = (state: ShiftState): ShiftState => {
  // Destructured rather than length-checked: `first` being defined is the
  // same fact as the list being non-empty, so this states it once instead of
  // leaving an `undefined` case that cannot happen but must still be written.
  const [first] = missingFromBasket(state)
  if (first === undefined || state.phase === 'closed') {
    return state
  }
  const label = ITEMS[first].label.toLowerCase()
  const tally: ShiftTally = { ...state.tally, lostSales: state.tally.lostSales + 1 }
  return advance(state, tally, `“Sorry, we’re out of ${label}.” They leave empty-handed.`)
}

/**
Points for how the age check was handled on a completed sale.
*/
export const idPointsForSale = (state: ShiftState): number => {
  if (!requiresIdCheck(state.customer)) {
    return 0
  }
  return state.idShown === undefined ? ID_SCORE.skippedCheck : idCheckPoints(state.idShown, true)
}

export const onConfirm = (state: ShiftState): ShiftState => {
  if (state.phase !== 'changing' || !canTender(state)) {
    return state
  }
  const grade = gradeChange(state.tray, changeOwed(state), state.drawerAtTender)
  // A price you quoted wrong and they did not catch is money the shop is out
  // by, quietly. It never announces itself at the counter — you meet it when
  // the drawer does not balance.
  // `canTender` has already established the phase is `changing`, which is
  // only reachable through the announcement that sets `quoted` — so this is
  // read directly rather than defaulted.
  const misquote = quotedPrice(state) - customerTotal(state.customer)
  // Selling beer or tobacco without looking at an ID is its own mistake,
  // whether or not the customer happened to be old enough. Getting away with
  // it is not the same as doing it right.
  const idPoints = idPointsForSale(state)
  const par = parMs(lineCount(state.customer), state.customer.cigarette !== undefined)
  const speed = grade.correct ? speedPoints(state.elapsedMs - state.customerStartMs, par) : 0
  const tally: ShiftTally = {
    ...state.tally,
    served: state.tally.served + 1,
    exactChange: state.tally.exactChange + (grade.correct ? 1 : 0),
    wrongChange: state.tally.wrongChange + (grade.correct ? 0 : 1),
    sloppyChange: state.tally.sloppyChange + (grade.surplusCoins > 0 ? 1 : 0),
    misquoted: state.tally.misquoted + (misquote === 0 ? 0 : 1),
    drawerDelta: state.tally.drawerDelta + grade.drawerDelta + misquote,
    score: state.tally.score + grade.points + speed + idPoints,
  }
  // The cash physically on the counter goes into the till. The tray has
  // already been taken out of it piece by piece, so this closes the loop:
  // money is conserved.
  const drawer = mergePurses(state.drawer, paidPurse(state))
  // Takings are what the shop *should* have taken — the real price of the
  // goods. Quoting wrong does not change what the basket was worth, which is
  // precisely why the discrepancy shows up.
  const takings = state.takings + customerTotal(state.customer)
  // Goods leave the shelf when the sale completes rather than when they are
  // scanned: a transaction abandoned halfway puts nothing back, because
  // nothing ever left.
  let stock = state.stock
  for (const line of state.customer.basket) {
    for (let n = 0; n < line.qty; n += 1) {
      stock = takeFromShelf(stock, line.item)
    }
  }
  return advance({ ...state, drawer, takings, stock }, tally, confirmMessage(grade))
}
