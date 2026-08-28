import { act } from '@testing-library/react'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from './mount'

/**
 * The bootstrap file is the one people leave uncovered. Both branches — a
 * mount point present and absent — are exercised here, and the mounted one is
 * torn down before the suite ends so the game loop's requestAnimationFrame
 * cannot outlive the jsdom environment.
 */
describe('mount', () => {
  let root: Root | undefined

  beforeEach(() => {
    vi.resetModules()
    document.body.replaceChildren();
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    root = undefined
    document.body.replaceChildren();
  })

  it('mounts the app into #root when it exists', () => {
    const mountPoint = document.createElement('div')
    mountPoint.id = 'root'
    document.body.append(mountPoint)

    // createRoot().render() commits asynchronously; act flushes it.
    act(() => {
      root = mount()
    })

    expect(mountPoint.textContent).toContain('6/7')
  })

  it('does nothing when there is no mount point', () => {
    act(() => {
      root = mount()
    })

    expect(root).toBeUndefined()
    expect(document.body.textContent).toBe('')
  })

  // main.tsx itself is three lines of wiring. Importing it with no `#root`
  // present covers them without leaving a live React tree behind.
  it('the entry point runs without a mount point', async () => {
    await expect(import('./main')).resolves.toBeDefined()
    expect(document.body.textContent).toBe('')
  })
})
