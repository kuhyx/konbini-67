/**
 * Injectable time source.
 *
 * Now a re-export of `@kuhyx/ts-core`'s shared clock, which iron-and-anvil
 * uses too. Kept as a local module rather than pointing every import at the
 * package directly: `src/core/` is this game's own seam, and the lint rule
 * banning `performance.now()` outside it stays meaningful.
 */
export {
  createManualClock,
  createRealClock,
  realClock,
  type Clock,
  type ManualClock,
} from '@kuhyx/ts-core'
