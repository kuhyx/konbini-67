import type { CSSProperties, JSX } from 'react'
import { type CounterThing, describeThing } from '../core/catalog'
import { LASER_X, type Placed, type Point } from '../core/layout'
import { type Mess, type MessKind } from '../core/mess'
import { type Denom, formatYen } from '../core/money'
import { useDrag } from './use-drag'

export interface CounterTopProperties {
  readonly goods: readonly Placed<CounterThing>[]
  /**
   * The customer's money, lying where they put it. Yours to count, not to
   * move — counting a scattered pile is the whole point of it being physical.
   */
  readonly cash: readonly Placed<Denom>[]
  /**
   * Whether goods can currently be swept over the beam.
   */
  readonly canScan: boolean
  readonly onSweep: (item: number, to: Point) => void
  /**
   * Spills and litter waiting to be wiped up.
   */
  readonly messes: readonly Mess[]
  readonly onClean: (id: number) => void
}

/**
 * What each kind of mess looks like.
 *
 * A click rather than a drag, deliberately: round three settled that the test
 * is whether the physical act is the *interesting* part of the job. Passing an
 * item over a scanner is; wiping a counter is one motion with no decision in
 * it, and making it a drag would be friction cosplaying as depth.
 */
const MESS_GLYPH: Record<MessKind, string> = {
  spill: '💧',
  litter: '🗑️',
  crumbs: '🍞',
}

/**
 * The counter: your side on the left, the scanner beam down the middle, the
 * customer's money on the right.
 *
 * Goods are dragged over the beam, because passing an item over a scanner is
 * a movement and nothing else. Change is *not* dragged — that was tried and
 * reverted, since choosing which coins make ¥348 is a decision, and decisions
 * belong on buttons. The two halves of the job are different, so the two
 * inputs are different.
 */
export const CounterTop = ({
  goods,
  cash,
  canScan,
  onSweep,
  messes,
  onClean,
}: CounterTopProperties): JSX.Element => {
  // Destructured rather than kept as one object: `drag` is plain state that
  // the render below reads every frame, and pulling it out keeps that obvious
  // (to a reader and to the lint rule that watches for ref reads in render).
  const { drag, surfaceReference, onPointerDown, onPointerMove, onPointerUp } = useDrag({
    pieces: goods,
    onDrop: onSweep,
    enabled: canScan,
  })

  return (
    <div
      className="counter-top"
      ref={surfaceReference}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="laser" style={{ left: `${String(LASER_X * 100)}%` }} />

      {messes.map((mess) => (
        <button
          key={mess.id}
          type="button"
          className="mess"
          style={{ left: `${String(mess.at.x * 100)}%`, top: `${String(mess.at.y * 100)}%` }}
          aria-label={`Wipe up the ${mess.kind}`}
          onClick={() => {
            onClean(mess.id)
          }}
        >
          {MESS_GLYPH[mess.kind]}
        </button>
      ))}

      {goods.map((piece, index) => {
        const held = drag?.index === index ? drag.at : piece.at
        const thing = describeThing(piece.what)
        return (
          <span
            key={`${piece.what.kind}-${piece.what.id}-${String(index)}`}
            className={drag?.index === index ? 'good held' : 'good'}
            style={{
              left: `${String(held.x * 100)}%`,
              top: `${String(held.y * 100)}%`,
              transform: `rotate(${String(piece.tilt)}deg)`,
              // Size the glyph, not the box. `scale()` inside `transform`
              // composes after the standalone `translate` that centres the
              // piece, so it scaled around the wrong origin and every item
              // still read as one uniform size. Driving `font-size` makes an
              // umbrella actually larger than a pack of batteries.
              '--thing-size': String(thing.size),
            } as CSSProperties}
            aria-label={thing.label}
          >
            {thing.emoji}
          </span>
        )
      })}

      {cash.map((piece, index) => (
        <span
          key={`tender-${String(piece.what)}-${String(index)}`}
          className={piece.what >= 1000 ? 'cash note' : 'cash coin'}
          style={{
            left: `${String(piece.at.x * 100)}%`,
            top: `${String(piece.at.y * 100)}%`,
            transform: `rotate(${String(piece.tilt)}deg)`,
          }}
        >
          {formatYen(piece.what)}
        </span>
      ))}
    </div>
  )
}
