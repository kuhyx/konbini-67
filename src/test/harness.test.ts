import { describe, expect, it, vi } from 'vitest'
import { installRaf } from './harness'

const REAL_RAF = requestAnimationFrame

/**
 * Guards the harness's own cleanup contract.
 *
 * `installRaf` is called from inside `it(...)` bodies, so its cleanup lives in
 * `src/test/setup.ts` — an `afterEach` added from within a running test does
 * not run after that test, and the stub would leak into the next one. That
 * leak is invisible to every other suite here, because they all install the
 * harness themselves; only this file asserts on a test that does not.
 */
describe('the raf harness', () => {
  it('replaces requestAnimationFrame while a test is running', () => {
    installRaf()
    expect(requestAnimationFrame).not.toBe(REAL_RAF)
  })

  it('restores the real requestAnimationFrame before the next test', () => {
    expect(requestAnimationFrame).toBe(REAL_RAF)
  })

  it('queues frames rather than running them, until pumped', () => {
    const raf = installRaf()
    const onFrame = vi.fn()
    requestAnimationFrame(onFrame)
    expect(raf.pending()).toBe(1)
    expect(onFrame).not.toHaveBeenCalled()
    raf.pump()
    expect(onFrame).toHaveBeenCalledTimes(1)
    expect(raf.pending()).toBe(0)
  })

  it('drops queued frames when the loop is cancelled', () => {
    const raf = installRaf()
    const onFrame = vi.fn()
    const handle = requestAnimationFrame(onFrame)
    cancelAnimationFrame(handle)
    expect(raf.pending()).toBe(0)
    raf.pump()
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('restores the real requestAnimationFrame on an explicit restore', () => {
    const raf = installRaf()
    raf.restore()
    expect(requestAnimationFrame).toBe(REAL_RAF)
  })
})
