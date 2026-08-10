import type { CigaretteId, ItemId } from './catalog'
import type { Purse } from './money'
import type { IdCard } from './id-check'
import type { Point } from './layout'
import type { RequestForm } from './shelf'

/**
 * One line on the receipt.
 */
export interface BasketLine {
  readonly item: ItemId
  readonly qty: number
}

/**
 * A cigarette request attached to a customer, if any.
 */
export interface CigaretteRequest {
  readonly cigarette: CigaretteId
  readonly form: RequestForm
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

export interface Customer {
  readonly id: number
  readonly name: string
  readonly basket: readonly BasketLine[]
  /**
   * What they hand over, in notes and coins.
   */
  readonly tender: Purse
  /**
   * How they reach for their money. Fixed when they walk in, so the same
   * quoted price always produces the same handful.
   */
  readonly style: PaymentStyle
  /**
   * Whether they are paying enough attention to query a wrong price.
   *
   * The ones who are not are the reason cash-up is tense: a misquote they
   * never noticed is a discrepancy nobody told you about.
   */
  readonly willQueryThePrice: boolean
  readonly cigarette: CigaretteRequest | undefined
  /**
   * What they produce if asked to prove their age.
   */
  readonly idCard: IdCard
}

/**
 * Where the transaction currently is.
 */
export type Phase =
  /**
   * Ringing items up.
   */
  | 'scanning'
  /**
   * Customer has asked for cigarettes; pick the slot.
   */
  | 'shelf'
  /**
   * Everything is rung up and the register shows the total. The customer is
   * waiting to be told what they owe.
   *
   * They cannot pay before they know the price — so their money is not on the
   * counter yet, and this is the phase that puts it there.
   */
  | 'announcing'
  /**
   * Waiting for the player to count out change.
   */
  | 'changing'
  /**
   * Shift over.
   */
  | 'closed'

export const PHASE_ORDER = ['scanning', 'shelf', 'announcing', 'changing', 'closed'] as const

/**
 * Where the clerk is looking.
 *
 * One closed union rather than a boolean per surface: looking at the shelf,
 * the clock or the notebook all mean the same thing — you are not looking at
 * the customer — and independent flags would multiply against `Phase` into a
 * branch space that cannot be covered without exclusions.
 */
export type Gaze = 'counter' | 'shelf' | 'clock' | 'stockroom'

export const GAZE_ORDER = [
  'counter',
  'shelf',
  'clock',
  'stockroom',
] as const satisfies readonly Gaze[]

/**
 * What looking somewhere costs you.
 */
export interface GazeSpec {
  /**
   * Whether the customer, their speech and the receipt stay visible.
   *
   * False everywhere except the counter: you cannot read the cigarette wall,
   * the clock or your own notes while also reading the basket in front of you.
   */
  readonly canSeeCustomer: boolean
  /**
   * Label for the control that turns your head this way.
   */
  readonly label: string
}

export const GAZE: Record<Gaze, GazeSpec> = {
  counter: { canSeeCustomer: true, label: 'Back to the counter' },
  shelf: { canSeeCustomer: false, label: 'Turn to the shelf' },
  clock: { canSeeCustomer: false, label: 'Look at the clock' },
  stockroom: { canSeeCustomer: false, label: 'Go out back' },
}

/**
 * What a clerk actually does when the till cannot make the change.
 *
 * None of these is a penalty. A real clerk in this spot does not "eat a
 * score deduction" — they talk to the customer, or they walk to the back.
 * The cost is time, the customer's patience, and a drawer that still has to
 * balance at the end of the shift.
 */
export type Resolution =
  /**
   * "Nie ma pan drobniej?" — ask them for smaller money.
   */
  | 'ask-smaller'
  /**
   * Suggest the card reader, which needs no change at all.
   */
  | 'offer-card'
  /**
   * "Będę winny grosika" — settle a few yen short, with their agreement.
   */
  | 'owe-the-coin'
  /**
   * Go and ask the manager to break a note.
   */
  | 'ask-manager'

export const RESOLUTION_ORDER = [
  'ask-smaller',
  'offer-card',
  'owe-the-coin',
  'ask-manager',
] as const satisfies readonly Resolution[]

export interface ResolutionSpec {
  /**
   * Label for the control that offers it.
   */
  readonly label: string
  /**
   * What the clerk says, or does.
   */
  readonly line: string
  /**
   * Whether the customer gets to refuse. The manager is not a customer, and
   * the card reader either exists or does not.
   */
  readonly canRefuse: boolean
  /**
   * Roughly how agreeable customers are to this, 0-1.
   */
  readonly acceptance: number
  /**
   * Seconds it costs, as milliseconds of shift time.
   */
  readonly costMs: number
}

export const RESOLUTIONS: Record<Resolution, ResolutionSpec> = {
  'ask-smaller': {
    label: 'Anything smaller?',
    line: '“Sumimasen — do you have anything smaller?”',
    canRefuse: true,
    acceptance: 0.55,
    costMs: 4000,
  },
  'offer-card': {
    label: 'Suggest card',
    line: '“Would card be alright?”',
    canRefuse: true,
    acceptance: 0.7,
    costMs: 5000,
  },
  'owe-the-coin': {
    label: 'Owe them the difference',
    line: '“I am a few yen short — is that alright?”',
    canRefuse: true,
    acceptance: 0.45,
    costMs: 3000,
  },
  'ask-manager': {
    label: 'Ask the manager for change',
    line: 'You duck into the back for a fresh roll of coins.',
    canRefuse: false,
    acceptance: 1,
    costMs: 20_000,
  },
}

/**
 * What the player did, as a closed union the shift reducer switches over.
 */
export type ShiftEvent =
  | { readonly kind: 'scan' }
  | { readonly kind: 'sweep'; readonly item: number; readonly to: Point }
  | { readonly kind: 'pick-slot'; readonly slot: number }
  | { readonly kind: 'look'; readonly at: Gaze }
  | { readonly kind: 'use-lookup' }
  /**
   * Tell the customer what they owe. The number is whatever the clerk typed,
   * which is not necessarily what the register says.
   */
  | { readonly kind: 'announce'; readonly amount: number }
  | { readonly kind: 'give'; readonly denom: number }
  | { readonly kind: 'take-back'; readonly denom: number }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'resolve'; readonly how: Resolution }
  | { readonly kind: 'ask-id' }
  | { readonly kind: 'refuse-sale' }
  /**
   * Put more of one item out. Costs time you are not at the till.
   */
  | { readonly kind: 'restock'; readonly item: ItemId }
  /**
   * Send away a customer whose basket the shop cannot fill.
   *
   * Distinct from `refuse-sale`, which is the age-check refusal: this one is
   * the shop's own fault, and it is scored as a lost sale rather than a
   * judgement call.
   */
  | { readonly kind: 'turn-away' }
  /**
   * Wipe up one mess. Identified rather than indexed: the list is rendered
   * sorted, so an index would silently clean the wrong thing.
   */
  | { readonly kind: 'clean'; readonly id: number }
  | { readonly kind: 'tick'; readonly deltaMs: number }
  | { readonly kind: 'restart'; readonly seed: number; readonly shift: number }

export const EVENT_KIND_ORDER = [
  'scan',
  'sweep',
  'pick-slot',
  'look',
  'use-lookup',
  'announce',
  'give',
  'take-back',
  'confirm',
  'resolve',
  'ask-id',
  'refuse-sale',
  'restock',
  'turn-away',
  'clean',
  'tick',
  'restart',
] as const

/**
 * Running tally for one shift.
 */
export interface ShiftTally {
  readonly served: number
  readonly exactChange: number
  readonly wrongChange: number
  readonly wrongBrand: number
  readonly lookupsUsed: number
  readonly sloppyChange: number
  /**
   * Sales where the price you said out loud was not the price on the register
   * and the customer did not pull you up on it.
   */
  readonly misquoted: number
  /**
   * Sales lost because the shelf was empty when someone wanted the thing.
   *
   * Housekeeping you did not do, measured in customers who walked.
   */
  readonly lostSales: number
  /**
   * Trips out back to put more stock on the shelf.
   */
  readonly restocked: number
  /**
   * Messes wiped up over the shift.
   */
  readonly cleaned: number
  readonly score: number
  /**
   * Net yen the drawer is off by. Negative means you shorted yourself.
   */
  readonly drawerDelta: number
}

export const EMPTY_TALLY: ShiftTally = {
  served: 0,
  exactChange: 0,
  wrongChange: 0,
  wrongBrand: 0,
  lookupsUsed: 0,
  sloppyChange: 0,
  misquoted: 0,
  lostSales: 0,
  restocked: 0,
  cleaned: 0,
  score: 0,
  drawerDelta: 0,
}
