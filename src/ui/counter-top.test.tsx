import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CounterThing } from '../core/catalog'
import { LASER_X, type Placed } from '../core/layout'
import type { Denom } from '../core/money'
import { asSurface, dragOn } from '../test/drag'
import { CounterTop } from './counter-top'

const goods: readonly Placed<CounterThing>[] = [
  { what: { kind: 'item', id: 'melonpan' }, at: { x: 0.1, y: 0.2 }, tilt: 5 },
  { what: { kind: 'item', id: 'beer' }, at: { x: 0.2, y: 0.6 }, tilt: -8 },
]

const cash: readonly Placed<Denom>[] = [
  { what: 1000, at: { x: 0.7, y: 0.3 }, tilt: 3 },
  { what: 100, at: { x: 0.8, y: 0.5 }, tilt: -2 },
  { what: 100, at: { x: 0.85, y: 0.4 }, tilt: 7 },
]

/**
 * Renders the counter with a fixed rectangle so unit coordinates map to real
 * client pixels, and returns the surface drags are aimed at.
 */
const mount = (
  properties: Partial<React.ComponentProps<typeof CounterTop>> = {},
): { surface: HTMLElement; container: HTMLElement } => {
  const { container } = render(
    <CounterTop goods={goods} cash={[]} canScan onSweep={vi.fn()} {...properties} />,
  )
  const surface = container.querySelector('.counter-top')
  if (surface === null) {
    throw new Error('no counter surface rendered')
  }
  return { surface: asSurface(surface as HTMLElement), container }
}

describe('CounterTop', () => {
  it('lays every loose item out on the counter', () => {
    mount()
    expect(screen.getByLabelText('Melonpan')).toBeInTheDocument()
    expect(screen.getByLabelText('Beer')).toBeInTheDocument()
  })

  it('rings an item up when you physically pass it over the beam', () => {
    const onSweep = vi.fn()
    const { surface } = mount({ onSweep })
    dragOn(surface, { x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 })
    expect(onSweep).toHaveBeenCalledWith(0, { x: 0.9, y: 0.2 })
  })

  it('reports the short drag too, so a miss stays a miss', () => {
    const onSweep = vi.fn()
    const { surface } = mount({ onSweep })
    // Stops before the beam: the reducer decides this earned no beep.
    dragOn(surface, { x: 0.1, y: 0.2 }, { x: 0.3, y: 0.2 })
    expect(onSweep).toHaveBeenCalledWith(0, { x: 0.3, y: 0.2 })
  })

  it('picks up whichever piece the grab landed on', () => {
    const onSweep = vi.fn()
    const { surface } = mount({ onSweep })
    dragOn(surface, { x: 0.2, y: 0.6 }, { x: 0.9, y: 0.6 })
    expect(onSweep).toHaveBeenCalledWith(1, { x: 0.9, y: 0.6 })
  })

  it('grabs nothing when the press misses every piece', () => {
    const onSweep = vi.fn()
    const { surface } = mount({ onSweep })
    dragOn(surface, { x: 0.55, y: 0.05 }, { x: 0.9, y: 0.05 })
    expect(onSweep).not.toHaveBeenCalled()
  })

  it('will not let you move goods once they are all rung up', () => {
    const onSweep = vi.fn()
    const { surface } = mount({ canScan: false, onSweep })
    dragOn(surface, { x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 })
    expect(onSweep).not.toHaveBeenCalled()
  })

  it('shows the customer cash as separate pieces, never a total', () => {
    mount({ goods: [], cash })
    // Two ¥100 coins appear as two coins, not as "¥200".
    expect(screen.getAllByText('¥100')).toHaveLength(2)
    expect(screen.getByText('¥1,000')).toBeInTheDocument()
    expect(screen.queryByText('¥1,200')).not.toBeInTheDocument()
  })

  it('positions each piece where it actually lies', () => {
    const { container } = mount()
    expect(container.querySelector('.good')).toHaveStyle({ left: '10%', top: '20%' })
  })

  it('follows the cursor while a piece is in your hand', () => {
    const { surface, container } = mount()
    dragOn(surface, { x: 0.1, y: 0.2 }, { x: 0.4, y: 0.2 })
    // Released, so it is back to being drawn at its own resting place.
    expect(container.querySelector('.good')).toHaveStyle({ left: '10%' })
  })

  it('tilts pieces so a pile reads as a pile', () => {
    const { container } = mount()
    // Tilt only — size travels separately, as `--thing-size`.
    expect(container.querySelector('.good')).toHaveStyle({ transform: 'rotate(5deg)' })
  })

  it('draws big things bigger than small ones', () => {
    // An umbrella is not the size of a pack of batteries, and drawing them
    // identically made the counter read as a row of icons.
    //
    // This asserts the size the piece is actually *drawn* at, not that a
    // `scale()` appears somewhere in a transform string. The earlier version
    // did the latter and passed for a build in which every item still rendered
    // at one uniform size: `scale()` inside `transform` composed against the
    // standalone `translate` that centres the piece instead of resizing it.
    // A style assertion that cannot fail when the screen is wrong is not a test.
    const { container } = mount({
      goods: [
        { what: { kind: 'item', id: 'umbrella' }, at: { x: 0.1, y: 0.2 }, tilt: 0 },
        { what: { kind: 'item', id: 'batteries' }, at: { x: 0.3, y: 0.2 }, tilt: 0 },
      ],
    })
    const drawnSizes = [...container.querySelectorAll<HTMLElement>('.good')].map((element) =>
      Number(element.style.getPropertyValue('--thing-size')),
    )
    const [big, small] = drawnSizes
    expect(drawnSizes).toStrictEqual([2.6, 0.55])
    // The spread has to be wide enough to actually read as different objects.
    // The first attempt (1.7 vs 0.7) drew 25.8px next to 21.3px, which nobody
    // could see. Assert the ratio, not just the ordering.
    expect((big ?? 0) / (small ?? 1)).toBeGreaterThan(3)
  })

  it('draws the beam where the arithmetic says it is', () => {
    const { container } = mount({ goods: [] })
    expect(container.querySelector('.laser')).toHaveStyle({ left: `${String(LASER_X * 100)}%` })
  })

  it('tells notes and coins apart', () => {
    const { container } = mount({ goods: [], cash })
    expect(container.querySelectorAll('.note')).toHaveLength(1)
    expect(container.querySelectorAll('.coin')).toHaveLength(2)
  })

  it('shows a cigarette packet as a thing on the counter', () => {
    mount({ goods: [{ what: { kind: 'cigarette', id: 'hi-lite' }, at: { x: 0.1, y: 0.7 }, tilt: 0 }] })
    expect(screen.getByLabelText('Hi-Lite')).toBeInTheDocument()
  })

  it('renders an empty counter without complaint', () => {
    const { container } = mount({ goods: [] })
    expect(container.querySelectorAll('.good')).toHaveLength(0)
  })
})
