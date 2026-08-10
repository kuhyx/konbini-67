import { describe, expect, it } from 'vitest'
import {
  didCrossLaser,
  distance,
  GRAB_RADIUS,
  isOnLaser,
  LASER_TOLERANCE,
  LASER_X,
  pickAt,
  type Placed,
  scatter,
} from './layout'
import { createRng } from './rng'

const COUNTER = { x: 0, y: 0, width: 1, height: 1 }

describe('didCrossLaser', () => {
  it('is true for a sweep from one side to the other', () => {
    expect(didCrossLaser({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 })).toBe(true)
  })

  it('is true sweeping back the other way', () => {
    expect(didCrossLaser({ x: 0.9, y: 0.5 }, { x: 0.1, y: 0.5 })).toBe(true)
  })

  it('is false for a drag that stops short of the beam', () => {
    // The classic miss: you did not sweep it far enough.
    expect(didCrossLaser({ x: 0.1, y: 0.5 }, { x: 0.4, y: 0.5 })).toBe(false)
  })

  it('is false for a drag entirely past the beam', () => {
    expect(didCrossLaser({ x: 0.7, y: 0.5 }, { x: 0.9, y: 0.5 })).toBe(false)
  })

  it('counts landing exactly on the line as a crossing', () => {
    expect(didCrossLaser({ x: 0.1, y: 0.5 }, { x: LASER_X, y: 0.5 })).toBe(true)
  })

  it('is false when nothing moved', () => {
    expect(didCrossLaser({ x: 0.2, y: 0.5 }, { x: 0.2, y: 0.5 })).toBe(false)
  })
})

describe('isOnLaser', () => {
  it('is true on the line and just beside it', () => {
    expect(isOnLaser({ x: LASER_X, y: 0.5 })).toBe(true)
    expect(isOnLaser({ x: LASER_X + LASER_TOLERANCE * 0.9, y: 0.5 })).toBe(true)
  })

  it('is false well clear of it', () => {
    expect(isOnLaser({ x: LASER_X + LASER_TOLERANCE * 2, y: 0.5 })).toBe(false)
  })
})

describe('scatter', () => {
  it('places every item inside the given region', () => {
    const placed = scatter(createRng(1), [1, 2, 3, 4, 5], COUNTER)
    expect(placed).toHaveLength(5)
    for (const piece of placed) {
      expect(piece.at.x).toBeGreaterThanOrEqual(COUNTER.x)
      expect(piece.at.x).toBeLessThanOrEqual(COUNTER.x + COUNTER.width)
      expect(piece.at.y).toBeGreaterThanOrEqual(COUNTER.y)
      expect(piece.at.y).toBeLessThanOrEqual(COUNTER.y + COUNTER.height)
    }
  })

  it('respects a region that is not the whole counter', () => {
    const region = { x: 0.5, y: 0.25, width: 0.2, height: 0.1 }
    const placed = scatter(createRng(3), ['a', 'b', 'c'], region)
    for (const piece of placed) {
      expect(piece.at.x).toBeGreaterThanOrEqual(0.5)
      expect(piece.at.x).toBeLessThanOrEqual(0.7)
      expect(piece.at.y).toBeGreaterThanOrEqual(0.25)
      expect(piece.at.y).toBeLessThanOrEqual(0.35)
    }
  })

  it('lays out identically for the same seed', () => {
    expect(scatter(createRng(9), [1, 2, 3], COUNTER)).toStrictEqual(
      scatter(createRng(9), [1, 2, 3], COUNTER),
    )
  })

  it('lays out differently for different seeds', () => {
    expect(scatter(createRng(1), [1, 2, 3], COUNTER)).not.toStrictEqual(
      scatter(createRng(2), [1, 2, 3], COUNTER),
    )
  })

  it('does not line everything up in a row', () => {
    const placed = scatter(createRng(5), [1, 2, 3, 4, 5, 6], COUNTER)
    const xs = new Set(placed.map((piece) => piece.at.x))
    expect(xs.size).toBeGreaterThan(1)
    // And tilts them, so a pile reads as a pile.
    expect(placed.some((piece) => piece.tilt !== 0)).toBe(true)
  })

  it('keeps what it was given', () => {
    const placed = scatter(createRng(1), ['coin'], COUNTER)
    expect(placed[0]?.what).toBe('coin')
  })

  it('scatters nothing when given nothing', () => {
    expect(scatter(createRng(1), [], COUNTER)).toStrictEqual([])
  })
})

describe('pickAt', () => {
  const pile: readonly Placed<string>[] = [
    { what: 'under', at: { x: 0.2, y: 0.2 }, tilt: 0 },
    { what: 'over', at: { x: 0.21, y: 0.21 }, tilt: 0 },
    { what: 'far', at: { x: 0.9, y: 0.9 }, tilt: 0 },
  ]

  it('finds the piece you clicked on', () => {
    expect(pickAt(pile, { x: 0.9, y: 0.9 })).toBe(2)
  })

  it('takes the top one when pieces overlap', () => {
    // Drawn in order, so the later one is lying on top.
    expect(pickAt(pile, { x: 0.205, y: 0.205 })).toBe(1)
  })

  it('is undefined when the click missed everything', () => {
    expect(pickAt(pile, { x: 0.5, y: 0.6 })).toBeUndefined()
  })

  it('is undefined for an empty counter', () => {
    expect(pickAt([], { x: 0.5, y: 0.5 })).toBeUndefined()
  })

  it('reaches exactly as far as the grab radius', () => {
    const single: readonly Placed<string>[] = [{ what: 'x', at: { x: 0.5, y: 0.5 }, tilt: 0 }]
    expect(pickAt(single, { x: 0.5 + GRAB_RADIUS * 0.9, y: 0.5 })).toBe(0)
    expect(pickAt(single, { x: 0.5 + GRAB_RADIUS * 1.5, y: 0.5 })).toBeUndefined()
  })
})

describe('distance', () => {
  it('is zero for the same point and positive otherwise', () => {
    expect(distance({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 })).toBe(0)
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})
