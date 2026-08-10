import { describe, expect, it, vi } from 'vitest'
import { createManualClock, createRealClock, realClock } from './clock'

describe('clock', () => {
  it('reads the performance timer for the real clock', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1234)
    expect(createRealClock().now()).toBe(1234)
    vi.restoreAllMocks()
  })

  it('exposes a shared real clock instance', () => {
    expect(typeof realClock.now()).toBe('number')
  })

  it('starts a manual clock at zero by default', () => {
    expect(createManualClock().now()).toBe(0)
  })

  it('starts a manual clock at the given time', () => {
    expect(createManualClock(500).now()).toBe(500)
  })

  it('advances a manual clock by a delta', () => {
    const clock = createManualClock(100)
    clock.advance(50)
    clock.advance(25)
    expect(clock.now()).toBe(175)
  })

  it('jumps a manual clock to an absolute time', () => {
    const clock = createManualClock(100)
    clock.set(9000)
    expect(clock.now()).toBe(9000)
  })
})
