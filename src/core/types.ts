import type { CigaretteId, ItemId } from './catalog'
import type { Purse } from './money'
import type { IdCard } from './id-check'
import type { RequestForm } from './shelf'

/**
One line on the receipt.
*/
export interface BasketLine {
  readonly item: ItemId
  readonly qty: number
}

/**
A cigarette request attached to a customer, if any.
*/
export interface CigaretteRequest {
  readonly cigarette: CigaretteId
  readonly form: RequestForm
}

/**
How a customer chooses to pay.

This table is load-bearing, not flavour. When every customer paid with one
round note, the drawer became a one-way ratchet: it filled with ¥5,000 notes
and bled ¥1,000/¥100/¥10 until it could not make change at all — measured at
twenty customers, ¥5,000 went 1 → +21 while ¥1,000 hit −55 and ¥100 −60,
with ¥1,000 running dry by the second customer. Real customers vary, and
that variety is what keeps a real till solvent.
*/
export type PaymentStyle =
  /**
  Counts out the exact amount.
  */
  | 'exact'
  /**
  Exact notes, then digs for coins so the change comes back round.
  */
  | 'near-exact'
  /**
  One note that covers it, nothing else.
  */
  | 'one-note'
  /**
  Several smaller notes rather than one big one.
  */
  | 'small-notes'
  /**
  A handful: a note plus whatever coins are in the pocket.
  */
  | 'scatter'

export const PAYMENT_STYLE_ORDER = [
  'exact',
  'near-exact',
  'one-note',
  'small-notes',
  'scatter',
] as const satisfies readonly PaymentStyle[]

export interface Customer {
  readonly id: number
  readonly name: string
  readonly basket: readonly BasketLine[]
  /**
  What they hand over, in notes and coins.
  */
  readonly tender: Purse
  /**
  How they reach for their money. Fixed when they walk in, so the same
  quoted price always produces the same handful.
  */
  readonly style: PaymentStyle
  /**
  Whether they are paying enough attention to query a wrong price.
  
  The ones who are not are the reason cash-up is tense: a misquote they
  never noticed is a discrepancy nobody told you about.
  */
  readonly willQueryThePrice: boolean
  readonly cigarette: CigaretteRequest | undefined
  /**
  What they produce if asked to prove their age.
  */
  readonly idCard: IdCard
}

/**
Where the transaction currently is.
*/
export type Phase =
  /**
  Ringing items up.
  */
  | 'scanning'
  /**
  Customer has asked for cigarettes; pick the slot.
  */
  | 'shelf'
  /**
  Everything is rung up and the register shows the total. The customer is
  waiting to be told what they owe.
  
  They cannot pay before they know the price — so their money is not on the
  counter yet, and this is the phase that puts it there.
  */
  | 'announcing'
  /**
  Waiting for the player to count out change.
  */
  | 'changing'
  /**
  Shift over.
  */
  | 'closed'

export const PHASE_ORDER = ['scanning', 'shelf', 'announcing', 'changing', 'closed'] as const

/**
Where the clerk is looking.

One closed union rather than a boolean per surface: looking at the shelf,
the clock or the notebook all mean the same thing — you are not looking at
the customer — and independent flags would multiply against `Phase` into a
branch space that cannot be covered without exclusions.
*/
export type Gaze = 'counter' | 'shelf' | 'clock' | 'stockroom' | 'kitchen'

export const GAZE_ORDER = [
  'counter',
  'shelf',
  'clock',
  'stockroom',
  'kitchen',
] as const satisfies readonly Gaze[]

/**
What looking somewhere costs you.
*/
export interface GazeSpec {
  /**
  Whether the customer, their speech and the receipt stay visible.
  
  False everywhere except the counter: you cannot read the cigarette wall,
  the clock or your own notes while also reading the basket in front of you.
  */
  readonly canSeeCustomer: boolean
  /**
  Label for the control that turns your head this way.
  */
  readonly label: string
}

export const GAZE: Record<Gaze, GazeSpec> = {
  counter: { canSeeCustomer: true, label: 'Back to the counter' },
  shelf: { canSeeCustomer: false, label: 'Turn to the shelf' },
  clock: { canSeeCustomer: false, label: 'Look at the clock' },
  stockroom: { canSeeCustomer: false, label: 'Go out back' },
  kitchen: { canSeeCustomer: false, label: 'To the hot case' },
}

export * from './resolution'
export * from './events'
