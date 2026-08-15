/**
 * Seeded RNG for the shift simulation.
 *
 * The generator itself now lives in `@kuhyx/ts-core`, which four repos share.
 * This file is the local seam: it re-exports the shared core unchanged and
 * keeps one adapter for the *exclusive-max* `nextInt` this codebase calls
 * everywhere.
 *
 * The shared `nextInt` is inclusive of both bounds (matching sims3-clone and
 * europe-county-map). Rewriting the seven call sites here to
 * `nextInt(rng, 0, n - 1)` would be an arithmetic edit on every random draw
 * in the game, and an off-by-one would silently change generated customers,
 * baskets and IDs rather than fail a type check. The adapter keeps this
 * codebase's semantics exactly as they were.
 */
export {
  createRng,
  nextFloat,
  pick,
  type Rng,
} from '@kuhyx/ts-core'

import { nextInt as sharedNextInt, type Rng } from '@kuhyx/ts-core'

/**
 * Deterministic integer in [0, maxExclusive).
 *
 * Note the *exclusive* upper bound, unlike `@kuhyx/ts-core`'s inclusive
 * `nextInt`. Consumes exactly one step either way.
 */
export const nextInt = (rng: Rng, maxExclusive: number): number =>
  sharedNextInt(rng, 0, maxExclusive - 1)
