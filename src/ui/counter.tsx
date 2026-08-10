import type { JSX } from 'react'
import { ITEMS } from '../core/catalog'
import { customerTotal } from '../core/customer'
import { requestLine } from '../core/speech'
import { formatYen } from '../core/money'
import type { Customer } from '../core/types'

export interface CounterProperties {
  readonly customer: Customer
  readonly scanned: number
  readonly showTotal: boolean
}

/**
 * The receipt. Items grey out until rung up, and the total only appears once
 * everything is scanned — you cannot pre-compute the change.
 */
export const Counter = ({ customer, scanned, showTotal }: CounterProperties): JSX.Element => {
  let rung = 0
  const rows: JSX.Element[] = []
  for (const line of customer.basket) {
    const spec = ITEMS[line.item]
    for (let n = 0; n < line.qty; n += 1) {
      rung += 1
      const isRung = rung <= scanned
      rows.push(
        <li key={`${line.item}-${String(n)}`} className={isRung ? 'rung' : ''}>
          <span>
            {spec.emoji} {spec.label}
          </span>
          <span>{isRung ? formatYen(spec.price) : '—'}</span>
        </li>,
      )
    }
  }

  return (
    <div className="panel">
      <h2>{customer.name}</h2>
      <div className="message">
        <span className="speech">“{requestLine(customer)}”</span>
      </div>
      <ul className="receipt">{rows}</ul>
      {showTotal ? (
        <>
          <div className="total">
            <span>TOTAL</span>
            <span>{formatYen(customerTotal(customer))}</span>
          </div>
          <p className="owed-hidden">
            They put their money on the counter. Count it, then count out the change.
          </p>
        </>
      ) : (
        <div className="total">
          <span>SCANNING…</span>
          <span>
            {String(scanned)}/{String(rung)}
          </span>
        </div>
      )}
    </div>
  )
}
