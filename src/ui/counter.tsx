import type { JSX } from 'react'
import { customerTotal } from '../core/customer'
import { type Mood, MOODS } from '../core/patience'
import { requestLine } from '../core/speech'
import { formatYen } from '../core/money'
import type { Customer } from '../core/types'

export interface CounterProperties {
  readonly customer: Customer
  /**
   * Whether the register is showing a total yet. It only does once every item
   * has gone over the beam.
   */
  readonly showTotal: boolean
  /**
   * How they feel about how long this is taking.
   *
   * Rendered as posture and speech, never as a number: a clerk reads a face,
   * not a patience bar, and a percentage on screen would do the reading for
   * the player.
   */
  readonly mood: Mood
}

/**
 * The customer, and the register display.
 *
 * There is no list of what they are buying: their shopping is physically on
 * the counter in front of you, and reading it off a panel instead would be
 * looking at the wrong thing. What is left is what a real clerk has — the
 * person, what they said, and the number on the register.
 */
export const Counter = ({ customer, showTotal, mood }: CounterProperties): JSX.Element => (
  <div className="panel customer">
    <h2>{customer.name}</h2>
    <div className="message">
      <span className="speech">“{requestLine(customer)}”</span>
    </div>
    {MOODS[mood].tell === '' ? undefined : (
      <p className={`tell ${mood}`}>
        <span className="posture">{customer.name} {MOODS[mood].tell}.</span>
        {MOODS[mood].line === '' ? undefined : (
          <span className="speech"> {MOODS[mood].line}</span>
        )}
      </p>
    )}
    {showTotal ? (
      <div className="register">
        <span className="register-label">REGISTER</span>
        <span className="register-total">{formatYen(customerTotal(customer))}</span>
      </div>
    ) : undefined}
  </div>
)
