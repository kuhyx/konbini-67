import { fireEvent } from '@testing-library/react'
import type { Point } from '../core/layout'

/**
 * The rectangle every dragged surface pretends to occupy in tests.
 *
 * jsdom has no layout engine, so a real `getBoundingClientRect` returns zeros
 * and every drag would land at the origin. Fixing a rectangle here is what
 * makes pointer drags drivable: unit coordinates multiply straight through it,
 * so `{ x: 0.5, y: 0.5 }` is client point (500, 200).
 */
export const SURFACE: DOMRect = {
  left: 0,
  top: 0,
  width: 1000,
  height: 400,
  right: 1000,
  bottom: 400,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}

/**
 * Pins a surface's measured rectangle to {@link SURFACE}.
 *
 * Scoped to the one element under test rather than patched onto the
 * prototype, so nothing leaks into another test's layout.
 */
export const stubRect = (node: HTMLElement): void => {
  node.getBoundingClientRect = (): DOMRect => SURFACE
}

/**
 * Where a unit point lands in client pixels on {@link SURFACE}.
 */
export const clientAt = (at: Point): { clientX: number; clientY: number } => ({
  clientX: SURFACE.left + at.x * SURFACE.width,
  clientY: SURFACE.top + at.y * SURFACE.height,
})

/**
 * Drags from one unit point to another with real pointer events.
 *
 * This is the interaction the game is built on, so tests drive it the same way
 * a hand does: press, move, release. `pointerId` is fixed because the surface
 * captures it, and jsdom's element does not implement pointer capture — the
 * calls are stubbed to no-ops by {@link stubPointerCapture}.
 */
export const dragOn = (node: HTMLElement, from: Point, to: Point): void => {
  // Each step is its own `fireEvent`, which flushes React's state between
  // them. Firing all three inside one batch would have the release read a
  // hand that had not yet been told it was holding anything.
  fireEvent.pointerDown(node, { pointerId: 1, ...clientAt(from) })
  fireEvent.pointerMove(node, { pointerId: 1, ...clientAt(to) })
  fireEvent.pointerUp(node, { pointerId: 1, ...clientAt(to) })
}

/**
 * Gives an element the pointer-capture methods jsdom leaves out.
 */
export const stubPointerCapture = (node: HTMLElement): void => {
  node.setPointerCapture = (): void => undefined
  node.releasePointerCapture = (): void => undefined
}

/**
 * Prepares a surface for dragging: fixed rectangle, working capture.
 */
export const asSurface = (node: HTMLElement): HTMLElement => {
  stubRect(node)
  stubPointerCapture(node)
  return node
}
