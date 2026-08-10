/**
 * The store's wall clock.
 *
 * The shift no longer shows a countdown. You are told when the shift ends, you
 * look up at a digital clock showing the current time, and you do the
 * subtraction yourself — which is what a clerk actually does.
 *
 * This is a pure projection of the shift's own `elapsedMs` onto a starting
 * time of day, not a second time source: nothing here reads a real clock, so
 * a seeded shift still replays byte-identically.
 */

/**
 * Minutes of shop time that pass per real second of play.
 *
 * A 180s shift covering 22:00 to 23:00 means one real second is twenty shop
 * seconds. Compressing time is what lets a "one hour closing shift" fit in
 * three minutes without the clock reading absurdly.
 */
export const SHOP_SECONDS_PER_REAL_MS = 20

/**
 * When a shift's clock starts: 22:00.
 *
 * All times here are plain minutes since midnight.
 */
export const SHIFT_START_MINUTES = 22 * 60

const MINUTES_PER_DAY = 24 * 60

/**
 * Two-digit zero-padded number, for clock display.
 */
const pad2 = (value: number): string => (value < 10 ? `0${String(value)}` : String(value))

/**
 * Formats minutes-since-midnight as a 24-hour `HH:MM` digital readout.
 *
 * Wraps past midnight, because a konbini closing shift crosses it.
 */
export const formatClock = (minutes: number): string => {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const hours = Math.floor(wrapped / 60)
  return `${pad2(hours)}:${pad2(wrapped % 60)}`
}

/**
 * The time of day shown on the wall clock after `elapsedMs` of a shift.
 *
 * Truncates to whole minutes: a real digital clock does not show you the
 * seconds ticking toward the next minute, which is precisely what makes
 * estimating the remaining time a judgement call rather than a readout.
 */
export const clockAt = (elapsedMs: number, startMinutes = SHIFT_START_MINUTES): number =>
  startMinutes + Math.floor((elapsedMs / 1000) * (SHOP_SECONDS_PER_REAL_MS / 60))

/**
 * The time of day a shift of `durationMs` ends. Told to the player once, at
 * the start — never recomputed on screen as a countdown.
 */
export const shiftEndsAt = (durationMs: number, startMinutes = SHIFT_START_MINUTES): number =>
  clockAt(durationMs, startMinutes)

/**
 * Where the hands point, in degrees clockwise from twelve.
 *
 * The hour hand creeps between the numerals as the minutes pass, exactly as a
 * real one does — which is what makes an analog face something you read rather
 * than something you glance at. There is no digital readout anywhere near it
 * on purpose: working out that the hands mean "twenty past ten" is the task.
 */
export const handAngles = (minutes: number): { readonly hour: number; readonly minute: number } => {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  const intoHour = wrapped % 60
  return {
    // 30° per hour, plus the fraction of the current hour already gone.
    hour: ((wrapped / 60) % 12) * 30,
    minute: intoHour * 6,
  }
}
