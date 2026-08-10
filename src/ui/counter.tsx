import type { JSX } from 'react'
import { customerTotal } from '../core/customer'
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
}

/**
 * The customer, and the register display.
 *
 * There is no list of what they are buying: their shopping is physically on
 * the counter in front of you, and reading it off a panel instead would be
 * looking at the wrong thing. What is left is what a real clerk has — the
 * person, what they said, and the number on the register.
 */
export const Counter = ({ customer, showTotal }: CounterProperties): JSX.Element => (
  <div className="panel customer">
    <h2>{customer.name}</h2>
    <div className="message">
      <span className="speech">“{requestLine(customer)}”</span>
    </div>
    {showTotal ? (
      <div className="register">
        <span className="register-label">REGISTER</span>
        <span className="register-total">{formatYen(customerTotal(customer))}</span>
      </div>
    ) : undefined}
  </div>
)
