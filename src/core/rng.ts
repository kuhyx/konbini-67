/**
 * Mutable state for a mulberry32 generator.
 */
export interface Rng {
  s: number
}

export const createRng = (seed: number): Rng => ({ s: seed >>> 0 })

/**
 * Deterministic float in [0, 1). Advances the generator.
 */
export const nextFloat = (rng: Rng): number => {
  rng.s = (rng.s + 0x6D_2B_79_F5) >>> 0
  let t = rng.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
}

/**
 * Deterministic integer in [0, maxExclusive).
 */
export const nextInt = (rng: Rng, maxExclusive: number): number =>
  Math.floor(nextFloat(rng) * maxExclusive)

/**
 * Deterministic pick from a non-empty tuple.
 *
 * Iterates rather than indexing: under `noUncheckedIndexedAccess` an index
 * read is `T | undefined`, and the undefined arm is unreachable here, so it
 * could never be covered.
 */
export const pick = <T>(rng: Rng, items: readonly [T, ...T[]]): T => {
  const target = nextInt(rng, items.length)
  let out: T = items[0]
  let seen = 0
  for (const item of items) {
    if (seen === target) {
      out = item
    }
    seen += 1
  }
  return out
}
