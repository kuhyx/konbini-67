/**
What a clerk actually does when the till cannot make the change.

None of these is a penalty. A real clerk in this spot does not "eat a
score deduction" — they talk to the customer, or they walk to the back.
The cost is time, the customer's patience, and a drawer that still has to
balance at the end of the shift.
*/
export type Resolution =
  /**
  "Nie ma pan drobniej?" — ask them for smaller money.
  */
  | 'ask-smaller'
  /**
  Suggest the card reader, which needs no change at all.
  */
  | 'offer-card'
  /**
  "Będę winny grosika" — settle a few yen short, with their agreement.
  */
  | 'owe-the-coin'
  /**
  Go and ask the manager to break a note.
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
  Label for the control that offers it.
  */
  readonly label: string
  /**
  What the clerk says, or does.
  */
  readonly line: string
  /**
  Whether the customer gets to refuse. The manager is not a customer, and
  the card reader either exists or does not.
  */
  readonly canRefuse: boolean
  /**
  Roughly how agreeable customers are to this, 0-1.
  */
  readonly acceptance: number
  /**
  Seconds it costs, as milliseconds of shift time.
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

