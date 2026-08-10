import type { JSX } from 'react'
import { ITEMS, type ItemId } from '../core/catalog'
import { LASER_X, type Placed, type Point } from '../core/layout'
import { type Denom, formatYen } from '../core/money'

export interface CounterTopProperties {
  readonly goods: readonly Placed<ItemId>[]
  readonly cash: readonly Placed<Denom>[]
  readonly onSweep: (item: number, to: Point) => void
}

/**
 * The counter itself: loose goods on the left, the customer's money on the
 * right, and the scanner beam down the middle.
 *
 * Positions are unit coordinates rendered as percentages — nothing here
 * measures a real element, because jsdom has no layout engine and a hit-test
 * against `getBoundingClientRect` would be untestable.
 *
 * Sweeping is a click on the item, which passes it across the beam. A real
 * pointer drag would be the same event with the same arithmetic; the click is
 * what a test can drive without synthesising pointer physics.
 */
export const CounterTop = ({ goods, cash, onSweep }: CounterTopProperties): JSX.Element => (
  <div className="counter-top">
    <div className="laser" style={{ left: `${String(LASER_X * 100)}%` }} />

    {goods.map((piece, index) => (
      <button
        // Position is what makes each piece distinct; two of the same item can
        // be lying next to each other.
        key={`${piece.what}-${String(piece.at.x)}-${String(piece.at.y)}`}
        type="button"
        className="good"
        style={{
          left: `${String(piece.at.x * 100)}%`,
          top: `${String(piece.at.y * 100)}%`,
          transform: `rotate(${String(piece.tilt)}deg)`,
        }}
        aria-label={`Scan ${ITEMS[piece.what].label}`}
        onClick={() => {
          // Sweep it clear across the beam to the far side.
          onSweep(index, { x: 0.95, y: piece.at.y })
        }}
      >
        {ITEMS[piece.what].emoji}
      </button>
    ))}

    {cash.map((piece) => (
      <span
        key={`${String(piece.what)}-${String(piece.at.x)}-${String(piece.at.y)}`}
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
