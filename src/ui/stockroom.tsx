/**
 * The stockroom: what is running low, and the crates to put it out from.
 *
 * Shelves are listed lowest-first because that is the decision the room
 * exists to support — under time pressure you want to see what is nearly gone
 * without reading fourteen numbers. Full shelves are shown too, greyed, so the
 * list does not reflow as you work through it: a control that moves under the
 * cursor between renders is its own small cruelty.
 */

import type { JSX } from 'react'
import { ITEM_ORDER, ITEMS, type ItemId } from '../core/catalog'
import { SHELF_CAPACITY, type Stock } from '../core/stock'

export interface StockroomProperties {
  readonly stock: Stock
  /**
   * False while frozen or mid-transaction: you cannot be out back and at the
   * till at the same time.
   */
  readonly enabled: boolean
  readonly onRestock: (item: ItemId) => void
}

/**
 * Lowest stock first, ties broken by catalog order so the list is stable.
 */
const byUrgency = (stock: Stock): readonly ItemId[] =>
  ITEM_ORDER.map((id, index) => ({ id, index }))
    .toSorted((a, b) => stock[a.id] - stock[b.id] || a.index - b.index)
    .map((entry) => entry.id)

export const Stockroom = ({ stock, enabled, onRestock }: StockroomProperties): JSX.Element => (
  <div className="panel stockroom">
    <h2>Out back</h2>
    <p className="hint">Putting stock out takes time. The counter is not watching itself.</p>
    <ul className="crates">
      {byUrgency(stock).map((id) => {
        const left = stock[id]
        const isFull = left >= SHELF_CAPACITY
        return (
          <li key={id}>
            <button
              type="button"
              className={left === 0 ? 'crate empty' : 'crate'}
              disabled={!enabled || isFull}
              onClick={() => {
                onRestock(id)
              }}
            >
              <span className="crate-emoji">{ITEMS[id].emoji}</span>
              <span className="crate-label">{ITEMS[id].label}</span>
              <span className="crate-count">
                {left === 0 ? 'out' : `${String(left)}/${String(SHELF_CAPACITY)}`}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  </div>
)
