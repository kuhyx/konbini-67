import { describe, expect, it } from 'vitest'
import { type Mess, MESS_TOLERANCE } from './mess'
import {
  APOLOGY_FORGIVES_MS,
  APOLOGY_MS,
  canApologise,
  MOOD_AT_MS,
  MOOD_ORDER,
  MOODS,
  moodFor,
} from './patience'

const clean: readonly Mess[] = []

const filthy = (count: number): readonly Mess[] =>
  Array.from({ length: count }, (_, index) => ({
    kind: 'litter' as const,
    at: { x: 0.5, y: 0.7 },
    id: index,
  }))

describe('moodFor', () => {
  it('is patient for an ordinary wait', () => {
    // The mechanic punishes a shift gone wrong, not competent slowness.
    expect(moodFor(0, clean)).toBe('patient')
    expect(moodFor(MOOD_AT_MS.restless - 1, clean)).toBe('patient')
  })

  it('escalates through every stage as the wait grows', () => {
    expect(moodFor(MOOD_AT_MS.restless, clean)).toBe('restless')
    expect(moodFor(MOOD_AT_MS.annoyed, clean)).toBe('annoyed')
    expect(moodFor(MOOD_AT_MS.leaving, clean)).toBe('leaving')
  })

  it('never skips backwards as time passes', () => {
    let seen = 0
    for (let waited = 0; waited <= MOOD_AT_MS.leaving + 5000; waited += 500) {
      const index = MOOD_ORDER.indexOf(moodFor(waited, clean))
      expect(index).toBeGreaterThanOrEqual(seen)
      seen = index
    }
  })

  it('makes waiting worse in a filthy shop', () => {
    // Not a separate grievance: a customer surrounded by litter is less
    // willing to give you the benefit of the doubt.
    const borderline = MOOD_AT_MS.restless - 2000
    expect(moodFor(borderline, clean)).toBe('patient')
    expect(moodFor(borderline, filthy(MESS_TOLERANCE + 6))).not.toBe('patient')
  })

  it('ignores a shop that is merely lived-in', () => {
    const borderline = MOOD_AT_MS.restless - 2000
    expect(moodFor(borderline, filthy(MESS_TOLERANCE))).toBe('patient')
  })
})

describe('MOODS', () => {
  it('describes every stage', () => {
    for (const mood of MOOD_ORDER) {
      expect(MOODS[mood]).toBeDefined()
    }
  })

  it('says nothing at all while they are still being polite', () => {
    expect(MOODS.patient.line).toBe('')
    expect(MOODS.restless.line).toBe('')
  })

  it('gives a visible tell before anyone speaks', () => {
    // A clerk reads a face, not a HUD: the escalation has to be watchable.
    expect(MOODS.restless.tell).not.toBe('')
    expect(MOODS.annoyed.line).not.toBe('')
  })
})

describe('canApologise', () => {
  it('is pointless before anyone minds', () => {
    // Otherwise it is a free action with no cost and no meaning, and it gets
    // spammed.
    expect(canApologise('patient')).toBe(false)
  })

  it('is available while there is still something to save', () => {
    expect(canApologise('restless')).toBe(true)
    expect(canApologise('annoyed')).toBe(true)
  })

  it('is too late once they have gone', () => {
    expect(canApologise('leaving')).toBe(false)
  })
})

describe('the price of an apology', () => {
  it('costs time, which is the currency the game already has', () => {
    expect(APOLOGY_MS).toBeGreaterThan(0)
  })

  it('buys a moment rather than a clean slate', () => {
    // A full reset would make apologising strictly better than being quick.
    expect(APOLOGY_FORGIVES_MS).toBeLessThan(MOOD_AT_MS.leaving)
  })
})
