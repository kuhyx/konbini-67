/**
 * The store's goods, as data tables.
 *
 * Escalation and content live in `Record<UnionId, Spec>` tables with a
 * matching `ORDER` tuple, so a single loop covers every entry. Branching code
 * costs a test per branch; a data table costs one loop.
 */

export const STORE_NAME = '6/7'

export type ItemId =
  | 'onigiri-tuna'
  | 'onigiri-salmon'
  | 'bento-katsu'
  | 'sandwich-egg'
  | 'melonpan'
  | 'oden'
  | 'coffee-can'
  | 'green-tea'
  | 'energy-drink'
  | 'beer'
  | 'pocky'
  | 'chips'
  | 'ice-cream'
  | 'umbrella'
  | 'batteries'

export interface ItemSpec {
  readonly label: string
  readonly emoji: string
  readonly price: number
  /**
   * Requires an age check before it can be sold.
   */
  readonly ageRestricted: boolean
}

/**
 * Iteration order for the catalogue. Every table-driven test loops this, so a
 * new item is covered the moment it is added here.
 */
export const ITEM_ORDER = [
  'onigiri-tuna',
  'onigiri-salmon',
  'bento-katsu',
  'sandwich-egg',
  'melonpan',
  'oden',
  'coffee-can',
  'green-tea',
  'energy-drink',
  'beer',
  'pocky',
  'chips',
  'ice-cream',
  'umbrella',
  'batteries',
] as const satisfies readonly ItemId[]

export const ITEMS: Readonly<Record<ItemId, ItemSpec>> = {
  'onigiri-tuna': { label: 'Tuna Mayo Onigiri', emoji: '🍙', price: 138, ageRestricted: false },
  'onigiri-salmon': { label: 'Salmon Onigiri', emoji: '🍙', price: 145, ageRestricted: false },
  'bento-katsu': { label: 'Katsu Bento', emoji: '🍱', price: 598, ageRestricted: false },
  'sandwich-egg': { label: 'Egg Sandwich', emoji: '🥪', price: 268, ageRestricted: false },
  melonpan: { label: 'Melonpan', emoji: '🍈', price: 158, ageRestricted: false },
  oden: { label: 'Oden Set', emoji: '🍢', price: 420, ageRestricted: false },
  'coffee-can': { label: 'Canned Coffee', emoji: '☕', price: 130, ageRestricted: false },
  'green-tea': { label: 'Green Tea', emoji: '🍵', price: 151, ageRestricted: false },
  'energy-drink': { label: 'Energy Drink', emoji: '⚡', price: 216, ageRestricted: false },
  beer: { label: 'Beer', emoji: '🍺', price: 231, ageRestricted: true },
  pocky: { label: 'Pocky', emoji: '🍫', price: 162, ageRestricted: false },
  chips: { label: 'Potato Chips', emoji: '🥔', price: 174, ageRestricted: false },
  'ice-cream': { label: 'Ice Cream', emoji: '🍦', price: 194, ageRestricted: false },
  umbrella: { label: 'Vinyl Umbrella', emoji: '☂️', price: 550, ageRestricted: false },
  batteries: { label: 'AA Batteries', emoji: '🔋', price: 385, ageRestricted: false },
}

/**
 * Cigarettes, requested by shelf number.
 *
 * This is the mechanic no other store sim has: in a real konbini the customer
 * says "Mevius, number 47" — or just "47" — and the clerk turns and grabs it
 * without looking.
 */
export type CigaretteId =
  | 'mevius'
  | 'seven-stars'
  | 'hope'
  | 'peace'
  | 'winston'
  | 'marlboro'
  | 'lucky-strike'
  | 'hi-lite'
  | 'echo'
  | 'caster'
  | 'pianissimo'
  | 'american-spirit'

export interface CigaretteSpec {
  readonly label: string
  /**
   * The number the customer says out loud.
   */
  readonly slot: number
  readonly price: number
}

export const CIGARETTE_ORDER = [
  'mevius',
  'seven-stars',
  'hope',
  'peace',
  'winston',
  'marlboro',
  'lucky-strike',
  'hi-lite',
  'echo',
  'caster',
  'pianissimo',
  'american-spirit',
] as const satisfies readonly CigaretteId[]

export const CIGARETTES: Readonly<Record<CigaretteId, CigaretteSpec>> = {
  mevius: { label: 'Mevius', slot: 12, price: 580 },
  'seven-stars': { label: 'Seven Stars', slot: 3, price: 600 },
  hope: { label: 'Hope', slot: 27, price: 560 },
  peace: { label: 'Peace', slot: 8, price: 620 },
  winston: { label: 'Winston', slot: 41, price: 540 },
  marlboro: { label: 'Marlboro', slot: 19, price: 600 },
  'lucky-strike': { label: 'Lucky Strike', slot: 33, price: 570 },
  'hi-lite': { label: 'Hi-Lite', slot: 5, price: 520 },
  echo: { label: 'Echo', slot: 47, price: 500 },
  caster: { label: 'Caster', slot: 22, price: 550 },
  pianissimo: { label: 'Pianissimo', slot: 36, price: 590 },
  'american-spirit': { label: 'American Spirit', slot: 14, price: 660 },
}

/**
 * Slot number -> brand, derived from {@link CIGARETTES} so the two can never
 * drift apart.
 */
export const SLOT_TO_CIGARETTE: ReadonlyMap<number, CigaretteId> = new Map(
  CIGARETTE_ORDER.map((id) => [CIGARETTES[id].slot, id] as const),
)

/**
 * Every slot on the wall, ascending — including empty ones, because the
 * gaps are part of what makes the numbers hard to remember.
 */
export const SHELF_SLOTS: readonly number[] = Array.from({ length: 48 }, (_, index) => index + 1)
