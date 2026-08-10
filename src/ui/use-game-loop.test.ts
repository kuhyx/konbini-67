import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createManualClock } from '../core/clock'
import { installRaf } from '../test/harness'
import { useGameLoop } from './use-game-loop'

describe('useGameLoop', () => {
  it('does not schedule a frame while stopped', () => {
    const raf = installRaf()
    const onFrame = vi.fn()
    renderHook(() => {
      useGameLoop(createManualClock(), false, onFrame)
    })
    expect(raf.pending()).toBe(0)
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('reports the elapsed delta between frames', () => {
    const raf = installRaf()
    const clock = createManualClock(1000)
    const onFrame = vi.fn()
    renderHook(() => {
      useGameLoop(clock, true, onFrame)
    })

    clock.advance(16)
    raf.pump()
    expect(onFrame).toHaveBeenCalledWith(16)

    clock.advance(32)
    raf.pump()
    expect(onFrame).toHaveBeenLastCalledWith(32)
  })

  it('keeps requesting frames while it runs', () => {
    const raf = installRaf()
    renderHook(() => {
      useGameLoop(createManualClock(), true, vi.fn())
    })
    expect(raf.pending()).toBe(1)
    raf.pump()
    expect(raf.pending()).toBe(1)
  })

  it('stops scheduling once unmounted', () => {
    const raf = installRaf()
    const { unmount } = renderHook(() => {
      useGameLoop(createManualClock(), true, vi.fn())
    })
    unmount()
    expect(raf.pending()).toBe(0)
  })

  it('uses the newest callback without restarting the loop', () => {
    const raf = installRaf()
    const clock = createManualClock()
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ cb }: { cb: (d: number) => void }) => {
        useGameLoop(clock, true, cb)
      },
      { initialProps: { cb: first } },
    )
    rerender({ cb: second })
    clock.advance(10)
    raf.pump()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(10)
  })
})
