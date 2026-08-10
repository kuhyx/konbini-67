import { describe, expect, it } from 'vitest'
import {
  CLEAN_MS,
  dropMess,
  type Mess,
  MESS_KIND_ORDER,
  MESS_TOLERANCE,
  messMultiplier,
  wipe,
} from './mess'
import { createRng } from './rng'

const drop = (count: number, seed = 1): readonly Mess[] => {
  const rng = createRng(seed)
  let messes: readonly Mess[] = []
  for (let n = 0; n < count; n += 1) {
    messes = dropMess(rng, messes, n)
  }
  return messes
}

describe('dropMess', () => {
  it('adds one mess', () => {
    expect(drop(1)).toHaveLength(1)
  })

  it('places it inside the mess area, clear of the scanner', () => {
    // Messes fight with the goods for space if they land on the left.
    for (const mess of drop(20)) {
      expect(mess.at.x).toBeGreaterThanOrEqual(0.42)
      expect(mess.at.x).toBeLessThanOrEqual(0.92)
      expect(mess.at.y).toBeGreaterThanOrEqual(0.6)
      expect(mess.at.y).toBeLessThanOrEqual(0.94)
    }
  })

  it('only produces kinds the UI can draw', () => {
    for (const mess of drop(30)) {
      expect(MESS_KIND_ORDER).toContain(mess.kind)
    }
  })

  it('produces every kind eventually', () => {
    const kinds = new Set(drop(80).map((mess) => mess.kind))
    expect(kinds.size).toBe(MESS_KIND_ORDER.length)
  })

  it('is deterministic for a seed', () => {
    expect(JSON.stringify(drop(10, 7))).toBe(JSON.stringify(drop(10, 7)))
  })

  it('gives every mess its own id', () => {
    const ids = drop(12).map((mess) => mess.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('wipe', () => {
  it('removes the one you cleaned', () => {
    const messes = drop(4)
    const target = messes[2]
    if (target === undefined) {
      throw new Error('expected four messes')
    }
    const after = wipe(messes, target.id)
    expect(after).toHaveLength(3)
    expect(after.some((mess) => mess.id === target.id)).toBe(false)
  })

  it('leaves everything alone for an id that is not there', () => {
    const messes = drop(3)
    expect(wipe(messes, 999)).toStrictEqual(messes)
  })

  it('empties out when the last one goes', () => {
    const messes = drop(1)
    const only = messes[0]
    if (only === undefined) {
      throw new Error('expected one mess')
    }
    expect(wipe(messes, only.id)).toStrictEqual([])
  })
})

describe('messMultiplier', () => {
  it('costs nothing while the shop is merely lived-in', () => {
    // One spill is a shop; the point is that neglect compounds, not that
    // every dropped wrapper is an incident.
    expect(messMultiplier([])).toBe(1)
    expect(messMultiplier(drop(MESS_TOLERANCE))).toBe(1)
  })

  it('starts to wear on people past the tolerance', () => {
    expect(messMultiplier(drop(MESS_TOLERANCE + 1))).toBeGreaterThan(1)
  })

  it('gets worse the longer it is left', () => {
    const some = messMultiplier(drop(MESS_TOLERANCE + 1))
    const more = messMultiplier(drop(MESS_TOLERANCE + 4))
    expect(more).toBeGreaterThan(some)
  })
})

describe('cleaning cost', () => {
  it('is an interruption, not an errand', () => {
    // Cheaper than a restocking trip: you are still behind the counter.
    expect(CLEAN_MS).toBeLessThan(4000)
  })
})
