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
  /**
   * Roughly how big the thing is, as a multiplier on the base draw size.
   *
   * A vinyl umbrella is not the size of a stick of Pocky, and drawing them
   * identically made the counter read as a row of icons rather than a pile of
   * shopping. It is a gameplay value too: a bigger thing is easier to grab.
   */
  readonly size: number
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
  'onigiri-tuna': { label: 'Tuna Mayo Onigiri', emoji: '🍙', price: 138, ageRestricted: false, size: 0.8 },
  'onigiri-salmon': { label: 'Salmon Onigiri', emoji: '🍙', price: 145, ageRestricted: false, size: 0.8 },
  'bento-katsu': { label: 'Katsu Bento', emoji: '🍱', price: 598, ageRestricted: false, size: 2.2 },
  'sandwich-egg': { label: 'Egg Sandwich', emoji: '🥪', price: 268, ageRestricted: false, size: 1.15 },
  melonpan: { label: 'Melonpan', emoji: '🍈', price: 158, ageRestricted: false, size: 1 },
  oden: { label: 'Oden Set', emoji: '🍢', price: 420, ageRestricted: false, size: 1.75 },
  'coffee-can': { label: 'Canned Coffee', emoji: '☕', price: 130, ageRestricted: false, size: 0.75 },
  'green-tea': { label: 'Green Tea', emoji: '🍵', price: 151, ageRestricted: false, size: 1.2 },
  'energy-drink': { label: 'Energy Drink', emoji: '⚡', price: 216, ageRestricted: false, size: 0.85 },
  beer: { label: 'Beer', emoji: '🍺', price: 231, ageRestricted: true, size: 1.15 },
  pocky: { label: 'Pocky', emoji: '🍫', price: 162, ageRestricted: false, size: 0.95 },
  chips: { label: 'Potato Chips', emoji: '🥔', price: 174, ageRestricted: false, size: 1.9 },
  'ice-cream': { label: 'Ice Cream', emoji: '🍦', price: 194, ageRestricted: false, size: 0.8 },
  umbrella: { label: 'Vinyl Umbrella', emoji: '☂️', price: 550, ageRestricted: false, size: 2.6 },
  batteries: { label: 'AA Batteries', emoji: '🔋', price: 385, ageRestricted: false, size: 0.55 },
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
 * Anything that can be lying on the counter waiting to be rung up.
 *
 * A packet of cigarettes is a physical object exactly like an onigiri is: the
 * clerk fetches it from the wall, puts it down, and passes it over the beam.
 * Tagging the two apart keeps the catalogue tables separate while letting the
 * counter hold a single list.
 */
export type CounterThing =
  | { readonly kind: 'item'; readonly id: ItemId }
  | { readonly kind: 'cigarette'; readonly id: CigaretteId }

/**
 * How a thing on the counter looks and what it is called.
 */
export const describeThing = (
  thing: CounterThing,
): { readonly label: string; readonly emoji: string; readonly size: number } =>
  thing.kind === 'item'
    ? { label: ITEMS[thing.id].label, emoji: ITEMS[thing.id].emoji, size: ITEMS[thing.id].size }
    : // A cigarette packet is a small, consistent box whatever the brand.
      { label: CIGARETTES[thing.id].label, emoji: '🚬', size: 0.8 }

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
