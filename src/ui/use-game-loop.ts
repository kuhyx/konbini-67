import { useEffect, useEffectEvent } from 'react'
import type { Clock } from '../core/clock'

/**
 * The one place in the app that owns a frame loop.
 *
 * Everything else is a pure props->JSX component, so all timing coverage
 * funnels through this hook and the RAF harness in `src/test/harness.ts`.
 * Local state plus effects is where uncoverable branches hide; keeping them
 * confined to one hook is what makes 100% reachable.
 */
export const useGameLoop = (
  clock: Clock,
  isRunning: boolean,
  onFrame: (deltaMs: number) => void,
): void => {
  // An effect event always sees the latest `onFrame` without being a
  // dependency of the effect below, so a new callback identity does not tear
  // down and re-arm the loop mid-shift.
  const emitFrame = useEffectEvent((deltaMs: number) => {
    onFrame(deltaMs)
  })

  useEffect(() => {
    if (!isRunning) {
      return
    }
    let handle = 0
    let last = clock.now()
    const step = (): void => {
      const now = clock.now()
      emitFrame(now - last)
      last = now
      handle = requestAnimationFrame(step)
    }
    handle = requestAnimationFrame(step)
    return (): void => {
      cancelAnimationFrame(handle)
    }
  }, [clock, isRunning])
}
