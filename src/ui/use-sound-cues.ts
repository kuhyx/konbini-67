import { useEffect, useRef } from 'react'
import { type Audible, cuesFor, type Speaker } from './sound'

/**
 * Plays whatever the last state change should have sounded like.
 *
 * The comparison lives in `cuesFor`, which is pure; this only remembers what
 * the previous frame looked like. A ref rather than state on purpose: the
 * remembered value must not itself cause a render, and nothing reads it during
 * one.
 *
 * Sound is driven from state rather than from the click handlers so that every
 * route into a change makes the same noise, and the reducer never learns that
 * audio exists.
 */
export const useSoundCues = (speaker: Speaker, now: Audible): void => {
  const previousRef = useRef(now)

  useEffect(() => {
    for (const cue of cuesFor(previousRef.current, now)) {
      speaker.play(cue)
    }
    previousRef.current = now
  }, [now, speaker])
}
