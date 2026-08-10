import { describe, expect, it } from 'vitest'
import { createRng, nextFloat, nextInt, pick } from './rng'

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(1)
    const b = createRng(1)
    const drawsA = [nextFloat(a), nextFloat(a), nextFloat(a)]
    const drawsB = [nextFloat(b), nextFloat(b), nextFloat(b)]
    expect(drawsA).toStrictEqual(drawsB)
  })

  it('produces different streams for different seeds', () => {
    expect(nextFloat(createRng(1))).not.toBe(nextFloat(createRng(2)))
  })

  it('masks the seed to a uint32', () => {
    expect(createRng(-1).s).toBe(0xFF_FF_FF_FF)
  })

  it('yields floats within [0, 1)', () => {
    const rng = createRng(42)
    for (let index = 0; index < 200; index += 1) {
      const value = nextFloat(rng)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('yields integers within [0, maxExclusive)', () => {
    const rng = createRng(7)
    for (let index = 0; index < 200; index += 1) {
      const value = nextInt(rng, 6)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(6)
      expect(Number.isSafeInteger(value)).toBe(true)
    }
  })

  it('picks every element of a tuple given enough draws', () => {
    const rng = createRng(3)
    const items = ['a', 'b', 'c'] as const
    const seen = new Set<string>()
    for (let index = 0; index < 200; index += 1) {
      seen.add(pick(rng, items))
    }
    expect(seen).toStrictEqual(new Set(['a', 'b', 'c']))
  })

  it('picks the only element of a single-item tuple', () => {
    expect(pick(createRng(9), ['only'] as const)).toBe('only')
  })
})
