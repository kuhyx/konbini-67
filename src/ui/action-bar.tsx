/**
 * Everything the clerk can do right now.
 *
 * Which controls exist is a function of the phase, so the bar reads as a list
 * of "what is available" rather than a fixed toolbar with most of it greyed
 * out — a real counter does not show you a "check ID" button while nobody is
 * standing there.
 *
 * Extracted from the app because the conditions accumulated past the point
 * where the render body could be read at a glance; each new mechanic adds at
 * least one, so this is where they go.
 */

import type { JSX } from 'react'
import type { ShelfMode } from '../core/shelf'
import type { Gaze, Resolution } from '../core/types'
import { HeadTurn } from './head-turn'
import { Negotiation } from './negotiation'
import { PriceEntry } from './price-entry'

export interface ActionBarProperties {
  readonly phase: 'scanning' | 'shelf' | 'announcing' | 'changing'
  readonly gaze: Gaze
  readonly shelfMode: ShelfMode
  readonly lookupPenalty: number
  /**
   * True on a restricted basket that has not been checked yet. Whether *this*
   * customer needs asking stays the player's call.
   */
  readonly canAskId: boolean
  /**
   * True only when the drawer genuinely cannot make the change.
   */
  readonly isStuck: boolean
  /**
   * True when the basket wants something the shop has run out of.
   */
  readonly isUnfillable: boolean
  readonly onAnnounce: (amount: number) => void
  readonly onConfirm: () => void
  readonly onLookup: () => void
  readonly onAskId: () => void
  readonly onRefuse: () => void
  readonly onTurnAway: () => void
  readonly onResolve: (how: Resolution) => void
  readonly onLook: (at: Gaze) => void
}

export const ActionBar = ({
  phase,
  gaze,
  shelfMode,
  lookupPenalty,
  canAskId,
  isStuck,
  isUnfillable,
  onAnnounce,
  onConfirm,
  onLookup,
  onAskId,
  onRefuse,
  onTurnAway,
  onResolve,
  onLook,
}: ActionBarProperties): JSX.Element => (
  <div className="actions">
    {phase === 'announcing' ? (
      <PriceEntry onAnnounce={onAnnounce} />
    ) : (
      <button type="button" className="primary" disabled={phase !== 'changing'} onClick={onConfirm}>
        That&rsquo;s everything
      </button>
    )}
    {phase === 'shelf' && shelfMode !== 'labelled' ? (
      <button type="button" className="ghost" onClick={onLookup}>
        Check the chart (&minus;{lookupPenalty})
      </button>
    ) : undefined}
    {canAskId ? (
      <button type="button" className="ghost" onClick={onAskId}>
        Ask for ID
      </button>
    ) : undefined}
    <button type="button" className="ghost" onClick={onRefuse}>
      Refuse the sale
    </button>
    {isUnfillable ? (
      <button type="button" className="ghost warn" onClick={onTurnAway}>
        Out of stock &mdash; send them away
      </button>
    ) : undefined}
    {isStuck ? <Negotiation onResolve={onResolve} /> : undefined}
    <HeadTurn gaze={gaze} onLook={onLook} />
  </div>
)
