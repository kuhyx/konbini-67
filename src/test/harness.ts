import { vi } from 'vitest'

export interface RafHarness {
  /**
   * Fire all queued frame callbacks.
   */
  pump: () => void
  pending: () => number
  restore: () => void
}

/**
 * Replaces requestAnimationFrame with a queue the test drives by hand.
 *
 * All frame-loop coverage in the app funnels through here, because
 * `useGameLoop` is the only hook that owns a loop.
 *
 * Self-restoring via the `afterEach` in `src/test/setup.ts`, so a test calls
 * this and forgets about it — no module-scoped handle is needed to hold the
 * harness between installation and cleanup.
 */
export const installRaf = (): RafHarness => {
  let queue: FrameRequestCallback[] = []
  let nextHandle = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    queue.push(callback)
    nextHandle += 1
    return nextHandle
  })
  vi.stubGlobal('cancelAnimationFrame', (): void => {
    queue = []
  })
  return {
    pump: (): void => {
      const batch = queue
      queue = []
      for (const callback of batch) {
        callback(0)
      }
    },
    pending: (): number => queue.length,
    restore: (): void => {
      vi.unstubAllGlobals()
    },
  }
}
