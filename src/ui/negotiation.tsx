/**
 * What a clerk actually does when the till cannot make the change.
 *
 * Only rendered when the drawer genuinely cannot pay out — a clerk does not
 * start negotiating over change they can simply hand over. None of these is a
 * penalty: they cost time and the customer's patience, not points.
 */

import type { JSX } from 'react'
import { type Resolution, RESOLUTION_ORDER, RESOLUTIONS } from '../core/types'

export interface NegotiationProperties {
  readonly onResolve: (how: Resolution) => void
}

export const Negotiation = ({ onResolve }: NegotiationProperties): JSX.Element => (
  <>
    {RESOLUTION_ORDER.map((how) => (
      <button
        key={how}
        type="button"
        className="ghost"
        onClick={() => {
          onResolve(how)
        }}
      >
        {RESOLUTIONS[how].label}
      </button>
    ))}
  </>
)
