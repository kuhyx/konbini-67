import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { App } from './app'

/**
 * Mount the app into `#root`, returning the root so a caller can unmount it.
 *
 * Split out of main.tsx so the bootstrap is testable without leaving a mount
 * behind: the game loop schedules requestAnimationFrame, and a frame that
 * lands after vitest tears the jsdom environment down surfaces as an
 * unhandled "window is not defined" and fails the whole run, intermittently.
 */
export function mount(): Root | undefined {
  const mountPoint = document.querySelector('#root')
  if (mountPoint === null) {
    return undefined
  }
  const root = createRoot(mountPoint)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  return root
}
