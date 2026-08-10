import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The bootstrap file is the one people leave uncovered. Both branches — a
 * mount point present and absent — are exercised by re-importing the module
 * with a fresh registry each time.
 */
describe('main', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.replaceChildren();
  })

  afterEach(() => {
    document.body.replaceChildren();
  })

  it('mounts the app into #root when it exists', async () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)

    // createRoot().render() commits asynchronously; act flushes it.
    await act(async () => {
      await import('./main')
    })

    expect(root.textContent).toContain('6/7')
  })

  it('does nothing when there is no mount point', async () => {
    await expect(import('./main')).resolves.toBeDefined()
    expect(document.body.textContent).toBe('')
  })
})
