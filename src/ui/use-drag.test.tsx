import { fireEvent, render } from '@testing-library/react'
import type { JSX } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Placed } from '../core/layout'
import { asSurface, clientAt } from '../test/drag'
import { useDrag } from './use-drag'

const pieces: readonly Placed<string>[] = [{ what: 'coin', at: { x: 0.2, y: 0.5 }, tilt: 0 }]

/**
 * A surface with no size, standing in for an element that has been detached
 * or has not been laid out.
 */
const FLAT: DOMRect = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  right: 0,
  bottom: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
}

/**
 * A bare surface driven by the hook, with no game attached.
 *
 * `attach` exists so one test can render the handlers *without* ever giving
 * the hook an element, which is the "nothing is laid out yet" path.
 */
const Surface = ({
  onDrop,
  enabled = true,
  attach = true,
}: {
  readonly onDrop: (index: number, to: { x: number; y: number }) => void
  readonly enabled?: boolean
  readonly attach?: boolean
}): JSX.Element => {
  const drag = useDrag({ pieces, onDrop, enabled })
  return (
    <div
      data-testid="surface"
      ref={attach ? drag.surfaceReference : undefined}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
    >
      {drag.drag === undefined ? 'idle' : `holding ${String(drag.drag.index)}`}
    </div>
  )
}

describe('useDrag', () => {
  it('does nothing at all when it has no surface to measure', () => {
    const onDrop = vi.fn()
    const { getByTestId } = render(<Surface onDrop={onDrop} attach={false} />)
    const node = getByTestId('surface')
    fireEvent.pointerDown(node, { pointerId: 1, ...clientAt({ x: 0.2, y: 0.5 }) })
    fireEvent.pointerUp(node, { pointerId: 1, ...clientAt({ x: 0.9, y: 0.5 }) })
    expect(onDrop).not.toHaveBeenCalled()
    expect(node).toHaveTextContent('idle')
  })

  it('ignores a press that lands on nothing', () => {
    const onDrop = vi.fn()
    const { getByTestId } = render(<Surface onDrop={onDrop} />)
    const node = asSurface(getByTestId('surface'))
    fireEvent.pointerDown(node, { pointerId: 1, ...clientAt({ x: 0.9, y: 0.1 }) })
    expect(node).toHaveTextContent('idle')
  })

  it('ignores a press while picking things up is disabled', () => {
    const onDrop = vi.fn()
    const { getByTestId } = render(<Surface onDrop={onDrop} enabled={false} />)
    const node = asSurface(getByTestId('surface'))
    fireEvent.pointerDown(node, { pointerId: 1, ...clientAt({ x: 0.2, y: 0.5 }) })
    expect(node).toHaveTextContent('idle')
  })

  it('ignores a move or a release when nothing is in your hand', () => {
    const onDrop = vi.fn()
    const { getByTestId } = render(<Surface onDrop={onDrop} />)
    const node = asSurface(getByTestId('surface'))
    fireEvent.pointerMove(node, { pointerId: 1, ...clientAt({ x: 0.5, y: 0.5 }) })
    fireEvent.pointerUp(node, { pointerId: 1, ...clientAt({ x: 0.5, y: 0.5 }) })
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('tracks the piece while it is being moved', () => {
    const onDrop = vi.fn()
    const { getByTestId } = render(<Surface onDrop={onDrop} />)
    const node = asSurface(getByTestId('surface'))
    fireEvent.pointerDown(node, { pointerId: 1, ...clientAt({ x: 0.2, y: 0.5 }) })
    expect(node).toHaveTextContent('holding 0')
    fireEvent.pointerMove(node, { pointerId: 1, ...clientAt({ x: 0.6, y: 0.5 }) })
    expect(node).toHaveTextContent('holding 0')
    fireEvent.pointerUp(node, { pointerId: 1, ...clientAt({ x: 0.9, y: 0.5 }) })
    expect(node).toHaveTextContent('idle')
    expect(onDrop).toHaveBeenCalledWith(0, { x: 0.9, y: 0.5 })
  })

  it('reads an unmeasurable surface as the origin rather than losing the piece', () => {
    const onDrop = vi.fn()
    const { getByTestId } = render(<Surface onDrop={onDrop} />)
    const node = asSurface(getByTestId('surface'))
    fireEvent.pointerDown(node, { pointerId: 1, ...clientAt({ x: 0.2, y: 0.5 }) })
    fireEvent.pointerMove(node, { pointerId: 1, ...clientAt({ x: 0.7, y: 0.5 }) })
    // Collapsed mid-drag: still measurable, just to nothing, so the piece
    // lands at the corner rather than vanishing.
    node.getBoundingClientRect = (): DOMRect => FLAT
    fireEvent.pointerUp(node, { pointerId: 1, ...clientAt({ x: 0.9, y: 0.5 }) })
    expect(onDrop).toHaveBeenCalledWith(0, { x: 0, y: 0 })
  })

  it('keeps hold of the piece if the surface goes away mid-drag', () => {
    const onDrop = vi.fn()
    const { getByTestId, rerender } = render(<Surface onDrop={onDrop} />)
    const node = asSurface(getByTestId('surface'))
    fireEvent.pointerDown(node, { pointerId: 1, ...clientAt({ x: 0.2, y: 0.5 }) })
    fireEvent.pointerMove(node, { pointerId: 1, ...clientAt({ x: 0.7, y: 0.5 }) })
    // The element is detached from the hook entirely: there is nothing left to
    // measure against, so the drop falls back to where the piece last was.
    rerender(<Surface onDrop={onDrop} attach={false} />)
    fireEvent.pointerMove(node, { pointerId: 1, ...clientAt({ x: 0.8, y: 0.5 }) })
    fireEvent.pointerUp(node, { pointerId: 1, ...clientAt({ x: 0.9, y: 0.5 }) })
    expect(onDrop).toHaveBeenCalledWith(0, { x: 0.7, y: 0.5 })
  })
})
