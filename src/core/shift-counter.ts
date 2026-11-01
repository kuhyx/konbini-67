/**
Event arms at the counter: the clock, mess, scanning, quoting, the shelf and the gaze.
*/

import { CIGARETTES, SLOT_TO_CIGARETTE } from './catalog'
import { customerTotal, tenderFor } from './customer'
import { formatYen } from './money'
import { didCrossLaser, type Point, scatter } from './layout'
import { CLEAN_MS, dropMess, MESS_INTERVAL_MS, wipe } from './mess'
import { MOODS } from './patience'
import type { Rng } from './rng'
import type { Gaze } from './types'
import { SHIFT_MS, type ShiftState } from './shift-state'
import { basketCount, layOutCash, lineCount, PACKET_AREA } from './shift-setup'
import { advance, isFrozen, moodOf } from './shift-queries'

export const onTick = (state: ShiftState, deltaMs: number): ShiftState => {
  const elapsedMs = state.elapsedMs + deltaMs
  if (elapsedMs >= SHIFT_MS) {
    return { ...state, elapsedMs: SHIFT_MS, phase: 'closed', message: 'Shift over.' }
  }
  const ticked = { ...state, elapsedMs }
  // Someone who has had enough leaves, taking the sale with them. That is the
  // whole penalty — no score deduction on top, per the no-scoreboard rule.
  if (moodOf(ticked) === 'leaving') {
    return advance(
      ticked,
      { ...state.tally, walkedOut: state.tally.walkedOut + 1 },
      `${MOODS.leaving.line} They put the basket down and go.`,
    )
  }
  if (elapsedMs < state.nextMessAtMs) {
    return ticked
  }
  // Something got dropped. The rng lives in state, so which mess and where
  // stays part of the seeded replay rather than a wall-clock accident.
  const rng: Rng = { s: state.rng.s }
  return {
    ...state,
    elapsedMs,
    rng,
    messes: dropMess(rng, state.messes, state.nextMessId),
    nextMessId: state.nextMessId + 1,
    nextMessAtMs: elapsedMs + MESS_INTERVAL_MS,
  }
}

/**
Wipes up one mess.

Allowed in any phase and from any gaze: unlike a restocking trip you are
still behind the counter, so this is an interruption rather than an errand.
*/
export const onClean = (state: ShiftState, id: number): ShiftState => {
  const remaining = wipe(state.messes, id)
  if (remaining.length === state.messes.length || isFrozen(state)) {
    return state
  }
  return {
    ...state,
    messes: remaining,
    frozenUntilMs: state.elapsedMs + CLEAN_MS,
    tally: { ...state.tally, cleaned: state.tally.cleaned + 1 },
  }
}

export const onScan = (state: ShiftState): ShiftState => {
  const total = lineCount(state.customer)
  if (isFrozen(state) || state.scanned >= total) {
    return state
  }
  const scanned = state.scanned + 1
  // The packet is not on the counter yet, so the basket runs out one short of
  // the full count and the customer's request interrupts here.
  if (state.customer.cigarette !== undefined && !state.shelfDone) {
    return scanned >= basketCount(state.customer)
      ? { ...state, scanned, phase: 'shelf', message: 'Cigarettes — pick the slot.' }
      : { ...state, scanned }
  }
  if (scanned < total) {
    return { ...state, scanned }
  }
  return {
    ...state,
    scanned,
    phase: 'announcing',
    message: 'Tell them what it comes to.',
  }
}

/**
Says a price out loud — whatever price the clerk typed.

The register shows the right number, but saying it is still a thing a human
does, and humans transpose digits. Quote the wrong amount and one of two
things happens, decided per customer when they walked in:

- **They are paying attention.** They query it, you are told, and nothing
  is settled: type it again.
- **They are not.** They pay the number you said. If you overcharged, the
  drawer ends the shift long; if you undercharged, it ends short. Either
  way nobody mentions it, and you meet it at cash-up.

That asymmetry is the whole mechanic: you never know which kind of customer
you got until you have already made the mistake.
*/
export const onAnnounce = (state: ShiftState, amount: number): ShiftState => {
  if (state.phase !== 'announcing' || isFrozen(state)) {
    return state
  }
  const owed = customerTotal(state.customer)
  if (amount !== owed && state.customer.willQueryThePrice) {
    return {
      ...state,
      elapsedMs: state.elapsedMs + MISQUOTE_MS,
      message: `“Sorry — ${formatYen(amount)}? I make it less than that.” Try again.`,
    }
  }
  const rng: Rng = { s: state.rng.s }
  const misquote = amount - owed
  return {
    ...state,
    rng,
    phase: 'changing',
    quoted: amount,
    cashOnCounter: layOutCash(rng, tenderFor(state.customer, amount)),
    drawerAtTender: state.drawer,
    message:
      misquote === 0
        ? `“${formatYen(amount)}, please.” They put their money down.`
        : `“${formatYen(amount)}, please.” They pay it without looking up.`,
  }
}

/**
How long being pulled up on a wrong price costs you.
*/
export const MISQUOTE_MS = 4000

/**
Sweeps one item across the counter.

It rings up only if the sweep actually took it through the beam. Stopping
short is a miss, and a miss costs nothing but the second it took — you pick
the thing up and pass it again, exactly as at a real till. The item stays
where you left it either way.
*/
export const onSweep = (state: ShiftState, item: number, to: Point): ShiftState => {
  const piece = state.onCounter[item]
  if (piece === undefined || isFrozen(state) || state.phase !== 'scanning') {
    return state
  }
  const moved = state.onCounter.map((each, index) =>
    index === item ? { ...each, at: to } : each,
  )
  if (!didCrossLaser(piece.at, to)) {
    return { ...state, onCounter: moved, message: 'No beep. Try again.' }
  }
  // A successful sweep takes the item off the counter and rings it up.
  const remaining = moved.filter((_, index) => index !== item)
  return { ...onScan({ ...state, onCounter: remaining }), onCounter: remaining }
}

export const onPickSlot = (state: ShiftState, slot: number): ShiftState => {
  const wanted = state.customer.cigarette
  if (wanted === undefined || state.phase !== 'shelf' || isFrozen(state)) {
    return state
  }
  const isRight = SLOT_TO_CIGARETTE.get(slot) === wanted.cigarette
  const label = CIGARETTES[wanted.cigarette].label
  // The packet is a physical thing: you fetch it, put it on the counter, and
  // it still has to go over the beam like everything else.
  const rng: Rng = { s: state.rng.s }
  const picked = SLOT_TO_CIGARETTE.get(slot) ?? wanted.cigarette
  const packet = scatter(rng, [{ kind: 'cigarette', id: picked } as const], PACKET_AREA)
  return {
    ...state,
    rng,
    phase: 'scanning',
    shelfDone: true,
    gaze: 'counter',
    onCounter: [...state.onCounter, ...packet],
    tally: isRight ? state.tally : { ...state.tally, wrongBrand: state.tally.wrongBrand + 1 },
    message: isRight
      ? 'You put the packet on the counter.'
      : `That's not ${label}. You put it on the counter anyway.`,
  }
}

/**
Turns the clerk's head.

Costs nothing but the time it takes — a real clerk is not fined for glancing
at the clock. The cost is that the shift keeps running while the customer is
out of view, so whatever you looked away to find, you had better remember.

The message is left alone on purpose: where you are looking is obvious from
what is in front of you, and narrating it would trample the line that
actually carries information ("No beep. Try again.").
*/
export const onLook = (state: ShiftState, at: Gaze): ShiftState => {
  return isFrozen(state) || state.gaze === at ? state : { ...state, gaze: at }
}
