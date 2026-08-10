import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Unstub globals after every test, everywhere.
//
// `installRaf` (src/test/harness.ts) is called from inside `it(...)` bodies,
// and an `afterEach` registered from within a running test does not run after
// that test — so cleanup cannot live in the harness itself without leaking the
// requestAnimationFrame stub into the following test. Registering here, in the
// setup file vitest loads before each test file, arms it unconditionally.
// `src/test/harness.test.ts` guards this.
afterEach(() => {
  vi.unstubAllGlobals()
  // The notebook persists to localStorage, so notes written by one test would
  // otherwise be sitting there for the next one — the same leak class as the
  // rAF stub above.
  localStorage.clear()
})
