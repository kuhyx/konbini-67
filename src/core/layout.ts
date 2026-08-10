/**
 * Where things physically are on the counter.
 *
 * Positions are plain numbers in a unit space (0-1 across, 0-1 down) that the
 * DOM renders with transforms. Game logic never measures a real element:
 * hit-testing is arithmetic over these coordinates, which is what keeps the
 * reducer pure and seeded replay byte-identical.
 *
 * A pointer drag does have to cross from screen space into this one, and that
 * is the single place a real rectangle is read. {@link toUnit} is that seam,
 * kept here as a pure function of numbers so it is testable without a layout
 * engine: the UI passes in the rect it measured, and everything downstream is
 * arithmetic again.
 *
 * Every position comes from the injected generator, so a seeded shift lays the
 * counter out identically on every replay.
 */

import { nextFloat, type Rng } from './rng'

export interface Point {
  readonly x: number
  readonly y: number
}

/**
 * Something lying on the counter that can be picked up and moved.
 */
export interface Placed<T> {
  readonly what: T
  readonly at: Point
  /**
   * Small rotation, in degrees, so a scattered pile does not look like a grid.
   */
  readonly tilt: number
}

/**
 * Where the scanner's beam runs, as a fraction across the counter.
 *
 * An item counts as scanned when it crosses this line, which is a comparison
 * between two numbers rather than a collision test against a rendered element.
 */
export const LASER_X = 0.5

/**
 * How close to the line counts as passing over it.
 */
export const LASER_TOLERANCE = 0.06

/**
 * Whether a drag from `from` to `to` passed the item over the beam.
 *
 * Crossing means the two ends sit on opposite sides: a real clerk sweeps the
 * item through the beam rather than resting it there, and stopping short is a
 * miss you simply repeat.
 */
export const didCrossLaser = (from: Point, to: Point): boolean =>
  (from.x < LASER_X && to.x >= LASER_X) || (from.x > LASER_X && to.x <= LASER_X)

/**
 * Whether a point is close enough to the beam to have triggered it.
 */
export const isOnLaser = (at: Point): boolean => Math.abs(at.x - LASER_X) <= LASER_TOLERANCE

/**
 * Scatters `count` items across a region, seeded.
 *
 * Used for both the customer's cash on the counter and the loose items waiting
 * to be rung up. A real counter is not a tidy grid, and having to actually
 * look at the pile is the point.
 */
export const scatter = <T>(
  rng: Rng,
  items: readonly T[],
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): readonly Placed<T>[] => {
  const placed: Placed<T>[] = []
  for (const what of items) {
    placed.push({
      what,
      at: freeSpot(rng, bounds, placed),
      tilt: (nextFloat(rng) - 0.5) * 24,
    })
  }
  return placed
}

/**
 * How far apart two pieces have to be before neither hides the other.
 *
 * Roughly the width of a note on the counter. Coins covering coins is not
 * "realistic clutter", it is money you cannot count.
 */
export const MIN_GAP = 0.075

/**
 * How many times to re-roll a position before accepting a crowded one.
 *
 * Bounded on purpose: with a small enough area and enough pieces there may be
 * no free spot at all, and a scatter that loops forever is worse than one that
 * occasionally puts two coins close together. Every draw comes from the seeded
 * generator either way, so a replay still lays out identically.
 */
const PLACEMENT_TRIES = 24

/**
 * Finds a spot in `bounds` that no already-placed piece is sitting on.
 */
const freeSpot = <T>(
  rng: Rng,
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  placed: readonly Placed<T>[],
): Point => {
  let candidate: Point = { x: 0, y: 0 }
  for (let attempt = 0; attempt < PLACEMENT_TRIES; attempt += 1) {
    candidate = {
      x: bounds.x + nextFloat(rng) * bounds.width,
      y: bounds.y + nextFloat(rng) * bounds.height,
    }
    if (placed.every((piece) => distance(piece.at, candidate) >= MIN_GAP)) {
      return candidate
    }
  }
  return candidate
}

/**
 * A measured rectangle, in screen pixels.
 *
 * Structurally the part of `DOMRect` that matters here. Taking it as plain
 * numbers rather than reading the element itself is what keeps this pure: the
 * UI does the measuring, this does the arithmetic, and a test supplies a
 * rectangle without needing a layout engine to produce one.
 */
export interface Rect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/**
 * Converts a screen point into counter coordinates.
 *
 * Clamped to the unit square: a drag that leaves the counter drops the piece at
 * the edge rather than somewhere off in negative space. A zero-sized rectangle
 * maps everything to the origin, which is the sane reading of "this element is
 * not laid out yet" and avoids a divide by zero.
 */
export const toUnit = (rect: Rect, clientX: number, clientY: number): Point => ({
  x: rect.width === 0 ? 0 : clamp01((clientX - rect.left) / rect.width),
  y: rect.height === 0 ? 0 : clamp01((clientY - rect.top) / rect.height),
})

/**
 * Where the customer stands, as a fraction across the counter.
 *
 * Change has to be physically carried over to them: dropping a coin here means
 * handing it over, and dropping it short means it is still sitting on your side
 * of the counter.
 */
export const CUSTOMER_X = 0.78

/**
 * Whether a piece dropped at `at` ended up in the customer's hands.
 */
export const isWithCustomer = (at: Point): boolean => at.x >= CUSTOMER_X

/**
 * Below this line is the open drawer.
 *
 * Dropping a coin back down here is how you undo a miscount — the same motion
 * as taking it out, in reverse.
 */
export const TILL_Y = 0.82

/**
 * Whether a piece was dropped back into the drawer.
 */
export const isOverTill = (at: Point): boolean => at.y >= TILL_Y

/**
 * Distance between two points. Used to decide what a click picked up.
 */
export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * How close a click has to land to count as grabbing a piece.
 */
export const GRAB_RADIUS = 0.08

/**
 * Index of the topmost piece near `at`, or undefined if the click missed.
 *
 * Later items win ties, matching what a player sees: the pile is drawn in
 * order, so the last one drawn is the one lying on top.
 */
export const pickAt = <T>(placed: readonly Placed<T>[], at: Point): number | undefined => {
  let found: number | undefined
  for (const [index, piece] of placed.entries()) {
    if (distance(piece.at, at) <= GRAB_RADIUS) {
      found = index
    }
  }
  return found
}
