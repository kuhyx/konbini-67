/**
 * The hot case: the roller, the oven and the drinks machine.
 *
 * Two halves. On the left, what you can start; on the right, what is already
 * going. The right-hand side is the only part of this shop that changes while
 * you are looking at something else, so it is drawn as things rather than as
 * a list of timers — you read the case by looking at it.
 *
 * No countdown is shown. Progress is a bar that fills and then a colour that
 * changes, which is as much as you would get from glancing at a real roller.
 */

import type { CSSProperties, JSX } from 'react'
import {
  CASE_CAPACITY,
  type Cooking,
  cookProgress,
  HOT_ITEM_ORDER,
  HOT_ITEMS,
  type HotItem,
  stageOf,
} from '../core/hotfood'
import { formatYen } from '../core/money'

export interface HotCaseProperties {
  readonly cases: readonly Cooking[]
  /**
   * Shift time, for working out how far along everything is.
   */
  readonly nowMs: number
  /**
   * False while frozen: your hands are busy.
   */
  readonly enabled: boolean
  readonly onCook: (what: HotItem) => void
  readonly onTakeOut: (id: number) => void
}

export const HotCase = ({
  cases,
  nowMs,
  enabled,
  onCook,
  onTakeOut,
}: HotCaseProperties): JSX.Element => (
  <div className="panel hot-case">
    <h2>Hot food</h2>

    <ul className="hot-starters">
      {HOT_ITEM_ORDER.map((what) => (
        <li key={what}>
          <button
            type="button"
            className="starter"
            disabled={!enabled || cases.length >= CASE_CAPACITY}
            onClick={() => {
              onCook(what)
            }}
          >
            <span className="starter-emoji">{HOT_ITEMS[what].emoji}</span>
            <span className="starter-label">{HOT_ITEMS[what].label}</span>
            <span className="starter-price">{formatYen(HOT_ITEMS[what].price)}</span>
          </button>
        </li>
      ))}
    </ul>

    {cases.length === 0 ? (
      <p className="hint">Nothing on. The case sells nothing while it is empty.</p>
    ) : (
      <ul className="hot-going">
        {cases.map((portion) => {
          const stage = stageOf(portion, nowMs)
          return (
            <li key={portion.id}>
              <button
                type="button"
                className={`portion ${stage}`}
                disabled={!enabled}
                aria-label={`${HOT_ITEMS[portion.what].label}, ${stage}`}
                onClick={() => {
                  onTakeOut(portion.id)
                }}
              >
                <span className="portion-emoji">{HOT_ITEMS[portion.what].emoji}</span>
                <span
                  className="portion-bar"
                  style={{ '--cooked': cookProgress(portion, nowMs) } as CSSProperties}
                />
              </button>
            </li>
          )
        })}
      </ul>
    )}
  </div>
)
