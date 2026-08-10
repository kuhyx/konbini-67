import type { JSX } from 'react'
import { type Denom, DENOMS, formatYen, type Purse, purseCount, purseValue } from '../core/money'

export interface TillProperties {
  readonly tray: Purse
  readonly enabled: boolean
  readonly onGive: (denom: Denom) => void
  readonly onTakeBack: (denom: Denom) => void
}

/**
 * The till tray.
 *
 * Change is built by clicking denominations, not typed into a box. Clicking
 * is what a clerk physically does, and it exposes the efficiency axis a text
 * field cannot: typing "350" says nothing about whether you would have handed
 * over 3x100+1x50 or 35x10.
 */
export const Till = ({ tray, enabled, onGive, onTakeBack }: TillProperties): JSX.Element => (
  <div className="panel">
    <h2>Till — click to count out</h2>
    <div className="tray">
      {DENOMS.map((denom) => {
        const held = tray[denom]
        return (
          <button
            key={denom}
            type="button"
            className={held > 0 ? 'denom has' : 'denom'}
            disabled={!enabled}
            aria-label={`Give ${formatYen(denom)}`}
            onClick={() => {
              onGive(denom)
            }}
          >
            {formatYen(denom)}
            <span className="count">{held > 0 ? `×${String(held)}` : '·'}</span>
          </button>
        )
      })}
    </div>
    <div className="total" style={{ marginTop: 'var(--sp-md)' }}>
      <span>IN HAND</span>
      <span>{formatYen(purseValue(tray))}</span>
    </div>
    <p className="hint">
      {purseCount(tray)} coin(s)/note(s) — the fewer the better
    </p>
    <div className="actions">
      {DENOMS.map((denom) =>
        tray[denom] > 0 ? (
          <button
            key={denom}
            type="button"
            className="ghost"
            disabled={!enabled}
            aria-label={`Take back ${formatYen(denom)}`}
            onClick={() => {
              onTakeBack(denom)
            }}
          >
            −{formatYen(denom)}
          </button>
        ) : undefined,
      )}
    </div>
  </div>
)
