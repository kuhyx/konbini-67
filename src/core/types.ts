import type { CigaretteId, ItemId } from './catalog'
import type { Purse } from './money'
import type { IdCard } from './id-check'
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

export interface Customer {
  readonly id: number
  readonly name: string
  readonly basket: readonly BasketLine[]
  /**
   * What they hand over, in notes and coins.
   */
  readonly tender: Purse
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
   * Waiting for the player to count out change.
   */
  | 'changing'
  /**
   * Shift over.
   */
  | 'closed'

export const PHASE_ORDER = ['scanning', 'shelf', 'changing', 'closed'] as const

/**
 * Where the clerk is looking.
 *
 * One closed union rather than a boolean per surface: looking at the shelf,
 * the clock or the notebook all mean the same thing — you are not looking at
 * the customer — and independent flags would multiply against `Phase` into a
 * branch space that cannot be covered without exclusions.
 */
export type Gaze = 'counter' | 'shelf' | 'clock' | 'notebook'

export const GAZE_ORDER = ['counter', 'shelf', 'clock', 'notebook'] as const satisfies
  readonly Gaze[]

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
  notebook: { canSeeCustomer: false, label: 'Check your notes' },
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
  | { readonly kind: 'pick-slot'; readonly slot: number }
  | { readonly kind: 'look'; readonly at: Gaze }
  | { readonly kind: 'use-lookup' }
  | { readonly kind: 'give'; readonly denom: number }
  | { readonly kind: 'take-back'; readonly denom: number }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'resolve'; readonly how: Resolution }
  | { readonly kind: 'ask-id' }
  | { readonly kind: 'refuse-sale' }
  | { readonly kind: 'tick'; readonly deltaMs: number }
  | { readonly kind: 'restart'; readonly seed: number; readonly shift: number }

export const EVENT_KIND_ORDER = [
  'scan',
  'pick-slot',
  'look',
  'use-lookup',
  'give',
  'take-back',
  'confirm',
  'resolve',
  'ask-id',
  'refuse-sale',
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
  score: 0,
  drawerDelta: 0,
}
