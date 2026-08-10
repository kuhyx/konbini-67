import type { JSX } from 'react'
import { clockAt, formatClock } from '../core/wallclock'

export interface WallClockProperties {
  readonly elapsedMs: number
  readonly endsAt: number
  /**
   * Whether the player is currently looking up at it.
   *
   * A clock on the wall is not in your field of view while you are working the
   * counter, so the face is only legible when you look — otherwise this is a
   * countdown in a different font, which is the thing being removed.
   */
  readonly isLookingUp: boolean
}

/**
 * The digital clock on the wall above the counter.
 *
 * Shows the time of day and nothing else. There is deliberately no "time
 * remaining": you are told once when the shift ends, and working out how long
 * that leaves is your job, exactly as it is behind a real counter.
 */
export const WallClock = ({
  elapsedMs,
  endsAt,
  isLookingUp,
}: WallClockProperties): JSX.Element => (
  <div className={isLookingUp ? 'wallclock looking' : 'wallclock'}>
    <span className="face" aria-label={isLookingUp ? 'Wall clock' : 'Wall clock, not in view'}>
      {isLookingUp ? formatClock(clockAt(elapsedMs)) : '· ·'}
    </span>
    {isLookingUp ? <small>off at {formatClock(endsAt)}</small> : undefined}
  </div>
)
