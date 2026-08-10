import type { JSX } from 'react'
import { CIGARETTE_ORDER, CIGARETTES, SHELF_SLOTS, SLOT_TO_CIGARETTE } from '../core/catalog'
import type { ShelfMode } from '../core/shelf'

export interface ShelfProperties {
  readonly mode: ShelfMode
  readonly enabled: boolean
  readonly lookupOpen: boolean
  readonly onPick: (slot: number) => void
}

/**
 * The cigarette wall.
 *
 * `labelled` shows brand names (shifts 1-2, you are reading), `faded` all but
 * hides them with the lookup chart available at a cost, `bare` gives you
 * nothing but numbers. This escalation is the whole mechanic: memorisation is
 * player-chosen, and lookups-per-shift is a stat you watch fall.
 */
export const Shelf = ({ mode, enabled, lookupOpen, onPick }: ShelfProperties): JSX.Element => (
  <div className="panel">
    <h2>Cigarettes — pick the slot</h2>
    <div className="shelf">
      {SHELF_SLOTS.map((slot) => {
        const brand = SLOT_TO_CIGARETTE.get(slot)
        const spec = brand === undefined ? undefined : CIGARETTES[brand]
        const classes = ['slot']
        if (spec === undefined) {
          classes.push('empty')
        }
        if (mode === 'faded') {
          classes.push('faded')
        }
        return (
          <button
            key={slot}
            type="button"
            className={classes.join(' ')}
            disabled={!enabled || spec === undefined}
            aria-label={`Slot ${String(slot)}`}
            onClick={() => {
              onPick(slot)
            }}
          >
            <span>{slot}</span>
            {spec !== undefined && mode !== 'bare' ? (
              <span className="brand">{spec.label}</span>
            ) : undefined}
          </button>
        )
      })}
    </div>
    {lookupOpen ? (
      <div className="chart">
        {CIGARETTE_ORDER.map((id) => (
          <div key={id}>
            {CIGARETTES[id].slot} · {CIGARETTES[id].label}
          </div>
        ))}
      </div>
    ) : undefined}
  </div>
)
