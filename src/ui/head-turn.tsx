/**
 * The controls that turn your head.
 *
 * One button per place you can look, minus wherever you are already looking —
 * "turn to the shelf" while facing the shelf is not an action. Extracted from
 * the app so the action bar stays readable as places to look accumulate; the
 * set is driven by `GAZE_ORDER`, so adding a fourth surface needs no change
 * here.
 */

import type { JSX } from 'react'
import { GAZE, GAZE_ORDER, type Gaze } from '../core/types'

export interface HeadTurnProperties {
  readonly gaze: Gaze
  readonly onLook: (at: Gaze) => void
}

export const HeadTurn = ({ gaze, onLook }: HeadTurnProperties): JSX.Element => (
  <>
    {GAZE_ORDER.map((at) =>
      at === gaze ? undefined : (
        <button
          key={at}
          type="button"
          className="ghost"
          onClick={() => {
            onLook(at)
          }}
        >
          {GAZE[at].label}
        </button>
      ),
    )}
  </>
)
