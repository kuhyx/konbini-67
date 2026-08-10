import type { JSX } from 'react'
import { type Denom, DENOMS, formatYen, type Purse } from '../core/money'

export interface TillProperties {
  /**
   * Change counted out so far, waiting in your hand.
   */
  readonly tray: Purse
  /**
   * What is left in the drawer. A denomination you are out of cannot be
   * handed over — you work with what the till actually holds.
   */
  readonly drawer: Purse
  readonly enabled: boolean
  readonly onGive: (denom: Denom) => void
  readonly onTakeBack: (denom: Denom) => void
}

/**
 * The till drawer.
 *
 * Counting change out is clicking compartments, not dragging coins. Dragging
 * was tried and reverted: picking a denomination is a *decision* about which
 * pieces make the amount, and the interesting part is the arithmetic, not the
 * hand-eye work of sliding thirty coins across a counter one at a time.
 *
 * The customer's own money stays physical, though — that is a different act.
 * Counting what they gave you means looking at a scattered pile and reading
 * it, which no amount of clicking would reproduce.
 */
export const Till = ({
  tray,
  drawer,
  enabled,
  onGive,
  onTakeBack,
}: TillProperties): JSX.Element => (
  <div className="till">
    {DENOMS.map((denom) => {
      const held = tray[denom]
      const left = drawer[denom]
      return (
        <div key={denom} className="till-column">
          <button
            type="button"
            className={held > 0 ? 'till-slot has' : 'till-slot'}
            disabled={!enabled || left === 0}
            aria-label={
              left === 0 ? `${formatYen(denom)} — none left` : `Give ${formatYen(denom)}`
            }
            onClick={() => {
              onGive(denom)
            }}
          >
            <span className="face">{formatYen(denom)}</span>
            <span className="count">{held > 0 ? `×${String(held)}` : '·'}</span>
            <span className="left">{left}</span>
          </button>
          {held > 0 ? (
            <button
              type="button"
              className="take-back"
              disabled={!enabled}
              aria-label={`Take back ${formatYen(denom)}`}
              onClick={() => {
                onTakeBack(denom)
              }}
            >
              −
            </button>
          ) : undefined}
        </div>
      )
    })}
  </div>
)
