/**
 * Where things physically are on the counter.
 *
 * Positions are plain numbers in a unit space (0-1 across, 0-1 down) that the
 * DOM renders with transforms. Nothing here measures a real element:
 * `getBoundingClientRect` returns zeros under jsdom, so any hit-test that read
 * real layout would be untestable, and the coverage bar would go with it.
 * Hit-testing is arithmetic over these coordinates instead.
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
): readonly Placed<T>[] =>
  items.map((what) => ({
    what,
    at: {
      x: bounds.x + nextFloat(rng) * bounds.width,
      y: bounds.y + nextFloat(rng) * bounds.height,
    },
    tilt: (nextFloat(rng) - 0.5) * 24,
  }))

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
