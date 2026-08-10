/**
 * How long the person in front of you will put up with this.
 *
 * Anger is not a new system — it is what patience running out *looks like*.
 * So there is no anger meter and no patience bar: a real clerk reads a face,
 * not a HUD. What the player sees is posture and a line of speech, and the
 * only number involved is the one they are already watching, the clock.
 *
 * Waiting is what costs you. Everything that takes time — looking something
 * up, walking out back, wiping a spill, arguing about an ID — spends a
 * resource that belongs to the customer rather than to you.
 */

import { type Mess, messMultiplier } from './mess'

/**
 * How annoyed the customer is, as something you could see across a counter.
 *
 * A closed union rather than a number, because the UI must not be able to
 * render "patience: 42%". Each stage is a visible behaviour.
 */
export type Mood =
  /**
   * Fine. Waiting is normal; shops have queues.
   */
  | 'patient'
  /**
   * Shifting their weight, looking at the clock. Still polite.
   */
  | 'restless'
  /**
   * Says something. This is the last warning you get.
   */
  | 'annoyed'
  /**
   * Done. Puts the basket down and leaves.
   */
  | 'leaving'

export const MOOD_ORDER = ['patient', 'restless', 'annoyed', 'leaving'] as const

/**
 * Milliseconds at the counter before each stage, for a clean shop.
 *
 * Generous on purpose. The mechanic is meant to punish a shift that has gone
 * badly wrong — three restocking trips and a lookup while somebody stands
 * there — not ordinary competent slowness. A player doing the arithmetic
 * carefully should never meet it.
 */
export const MOOD_AT_MS: Readonly<Record<Exclude<Mood, 'patient'>, number>> = {
  restless: 30_000,
  annoyed: 50_000,
  leaving: 70_000,
}

/**
 * What each stage looks like from behind the till.
 */
export interface MoodSpec {
  /**
   * The posture, as a short description the UI can show.
   */
  readonly tell: string
  /**
   * What they say, if anything. Empty while they are still being polite.
   */
  readonly line: string
}

export const MOODS: Readonly<Record<Mood, MoodSpec>> = {
  patient: { tell: '', line: '' },
  restless: { tell: 'shifts their weight', line: '' },
  annoyed: { tell: 'looks at the clock, pointedly', line: '“…Sumimasen?”' },
  leaving: { tell: 'puts the basket down', line: '“Forget it.”' },
}

/**
 * How annoyed someone is after `waitedMs` at the counter in a shop with
 * `messes` lying around.
 *
 * Mess makes waiting worse rather than making anger start early: a customer
 * in a filthy shop is less willing to give you the benefit of the doubt, which
 * is a multiplier on the wait rather than a separate grievance.
 */
export const moodFor = (waitedMs: number, messes: readonly Mess[]): Mood => {
  const felt = waitedMs * messMultiplier(messes)
  if (felt >= MOOD_AT_MS.leaving) {
    return 'leaving'
  }
  if (felt >= MOOD_AT_MS.annoyed) {
    return 'annoyed'
  }
  return felt >= MOOD_AT_MS.restless ? 'restless' : 'patient'
}

/**
 * Whether an apology is worth making.
 *
 * You cannot apologise to someone who is not annoyed yet — it would be a free
 * action with no cost and no meaning, and the player would spam it.
 */
export const canApologise = (mood: Mood): boolean => mood === 'restless' || mood === 'annoyed'

/**
 * What an apology costs, in milliseconds.
 *
 * It buys patience back, and the cost is the one currency the game already
 * has: a beat of time. Saying sorry while somebody waits is itself waiting.
 */
export const APOLOGY_MS = 1200

/**
 * How much of the wait an apology forgives.
 *
 * Less than a full reset. A real "sorry to keep you" buys you a moment, not a
 * clean slate, and a full reset would make the button strictly better than
 * being quick.
 */
export const APOLOGY_FORGIVES_MS = 18_000
