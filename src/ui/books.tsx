import { useState, type JSX } from 'react'
import { DENOMS, formatYen, type Purse } from '../core/money'
import { actualDiscrepancy, expectedDrawer, reconcile } from '../core/reconcile'

export interface BooksProperties {
  readonly drawer: Purse
  readonly openingFloat: Purse
  readonly takings: number
  readonly onSettle: (declared: number, actual: number) => void
}

/**
 * Cashing up.
 *
 * The till is laid out for counting and nothing is totalled for you: the
 * opening float, the day's takings and the drawer in front of you are the
 * three numbers, and the difference is yours to work out. Declaring an honest
 * shortfall is the skill — a clerk who knows their till is ¥50 down and says
 * so has done the job; one who insists it balances when it does not has not.
 */
export const Books = ({
  drawer,
  openingFloat,
  takings,
  onSettle,
}: BooksProperties): JSX.Element => {
  const [declared, setDeclared] = useState('')
  const expected = expectedDrawer(openingFloat, takings)
  const actual = actualDiscrepancy(drawer, expected)
  const parsed = Number(declared)
  const isReady = declared.trim() !== '' && !Number.isNaN(parsed)

  return (
    <div className="over books">
      <h2>Cash up</h2>
      <p className="hint">
        Count the drawer. Opening float was {formatYen(expected - takings)} and you took{' '}
        {formatYen(takings)}. How far out is it?
      </p>
      <ul className="drawer-count">
        {DENOMS.map((denom) => (
          <li key={denom}>
            <span>{formatYen(denom)}</span>
            <span>×{drawer[denom]}</span>
          </li>
        ))}
      </ul>
      <label htmlFor="declared">Drawer is out by</label>
      <input
        id="declared"
        type="text"
        inputMode="numeric"
        value={declared}
        placeholder="0"
        aria-label="Declared discrepancy in yen"
        onChange={(event) => {
          setDeclared(event.target.value)
        }}
      />
      <button
        type="button"
        className="primary"
        disabled={!isReady}
        onClick={() => {
          onSettle(reconcile(parsed, actual).declared, actual)
        }}
      >
        Close the books
      </button>
    </div>
  )
}
