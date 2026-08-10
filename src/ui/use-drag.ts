import { useCallback, useState } from 'react'
import { pickAt, type Placed, type Point, type Rect, toUnit } from '../core/layout'

/**
 * A drag in progress: which piece is in your hand, and where it currently is.
 */
export interface Drag {
  readonly index: number
  readonly at: Point
}

export interface UseDragOptions<T> {
  /**
   * The pieces lying on the surface, in draw order.
   */
  readonly pieces: readonly Placed<T>[]
  /**
   * Called when the piece is let go, with where it landed.
   */
  readonly onDrop: (index: number, to: Point) => void
  /**
   * Whether picking anything up is currently allowed.
   */
  readonly enabled: boolean
}

export interface DragHandlers {
  readonly drag: Drag | undefined
  readonly surfaceReference: (node: HTMLElement | null) => void
  readonly onPointerDown: (event: React.PointerEvent) => void
  readonly onPointerMove: (event: React.PointerEvent) => void
  readonly onPointerUp: (event: React.PointerEvent) => void
}

/**
 * Picking something up, moving it, and putting it down.
 *
 * This is the one drag implementation in the game: goods are dragged over the
 * scanner beam, and change is dragged out of the drawer and across to the
 * customer. They are the same physical act — grab the nearest piece, move it,
 * let go — so they share the code and therefore feel the same.
 *
 * The element's rectangle is measured here and nowhere else. That is the only
 * real-layout read in the project, and it is deliberately confined to this
 * seam: it converts screen pixels into the unit coordinates the pure core
 * already speaks, so no hit-testing or game rule ever touches the DOM. Tests
 * drive it by supplying their own rectangle, which is why this stays coverable
 * without a layout engine.
 *
 * Pointer events rather than HTML5 drag-and-drop: capture keeps the piece
 * following the cursor even when it leaves the element, and a dropped drag
 * outside the surface still resolves.
 */
export const useDrag = <T,>({ pieces, onDrop, enabled }: UseDragOptions<T>): DragHandlers => {
  const [drag, setDrag] = useState<Drag | undefined>(undefined)
  // The surface is held in state rather than a ref: it changes once, when the
  // element mounts, and every handler below is rebuilt from it anyway.
  const [surface, setSurface] = useState<HTMLElement | undefined>(undefined)

  // React hands a callback ref `null` on unmount; everything downstream of
  // here speaks `undefined`, so the boundary is normalised once, right here.
  const surfaceReference = useCallback((node: HTMLElement | null) => {
    setSurface(node ?? undefined)
  }, [])

  // Reading the rect on every event rather than caching it: the counter
  // resizes with the window, and a stale rectangle would put the piece
  // somewhere the cursor is not.
  const pointOf = useCallback(
    (event: React.PointerEvent): Point | undefined => {
      if (surface === undefined) {
        return undefined
      }
      const box: Rect = surface.getBoundingClientRect()
      return toUnit(box, event.clientX, event.clientY)
    },
    [surface],
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!enabled) {
        return
      }
      const at = pointOf(event)
      if (at === undefined) {
        return
      }
      const index = pickAt(pieces, at)
      if (index === undefined) {
        return
      }
      // Capture so the piece keeps following the cursor past the edge of the
      // counter, exactly as something in your hand would.
      event.currentTarget.setPointerCapture(event.pointerId)
      setDrag({ index, at })
    },
    [enabled, pieces, pointOf],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (drag === undefined) {
        return
      }
      const at = pointOf(event)
      if (at === undefined) {
        return
      }
      setDrag({ index: drag.index, at })
    },
    [drag, pointOf],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (drag === undefined) {
        return
      }
      const at = pointOf(event) ?? drag.at
      setDrag(undefined)
      onDrop(drag.index, at)
    },
    [drag, onDrop, pointOf],
  )

  return { drag, surfaceReference, onPointerDown, onPointerMove, onPointerUp }
}
