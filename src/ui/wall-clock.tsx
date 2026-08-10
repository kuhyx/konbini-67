import type { JSX } from 'react'
import { clockAt, handAngles } from '../core/wallclock'

export interface WallClockProperties {
  readonly elapsedMs: number
}

/**
 * Twelve marks around the face. Only the quarters get a long tick, which is
 * what makes the in-between positions something you judge.
 */
const MARKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/**
 * The analog clock on the wall.
 *
 * Hands and nothing else — no digits anywhere on it. Reading an analog face is
 * a small act of work, and doing that under time pressure is the mechanic; a
 * digital readout would just be the countdown again in a different font.
 *
 * It only renders while the player is actually looking at it, so it cannot be
 * consulted for free out of the corner of an eye.
 */
export const WallClock = ({ elapsedMs }: WallClockProperties): JSX.Element => {
  const angles = handAngles(clockAt(elapsedMs))
  return (
    <div className="panel wallclock-panel">
      <h2>The clock</h2>
      <div className="clock-face" aria-label="Wall clock">
        {MARKS.map((mark) => (
          <span
            key={mark}
            className={mark % 3 === 0 ? 'mark quarter' : 'mark'}
            style={{ transform: `rotate(${String(mark * 30)}deg)` }}
          />
        ))}
        <span
          className="hand hour"
          style={{ transform: `rotate(${String(angles.hour)}deg)` }}
        />
        <span
          className="hand minute"
          style={{ transform: `rotate(${String(angles.minute)}deg)` }}
        />
        <span className="pin" />
      </div>
      <p className="hint">You clock off at eleven.</p>
    </div>
  )
}
