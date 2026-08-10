import type { JSX } from 'react'
import { formatYen } from '../core/money'
import { gradeForShift } from '../core/score'
import type { Reconciliation } from '../core/reconcile'
import type { ShiftTally } from '../core/types'

export interface ShiftOverProperties {
  readonly tally: ShiftTally
  /**
   * How the books came out, once the till has been cashed up.
   */
  readonly books: Reconciliation
  readonly onRestart: () => void
}

export const ShiftOver = ({ tally, books, onRestart }: ShiftOverProperties): JSX.Element => (
  <div className="over">
    <p className="grade">{gradeForShift(tally.score, tally.served)}</p>
    <h2>Shift over</h2>
    <ul className="summary">
      <li>
        <span>Served</span>
        <span>{tally.served}</span>
      </li>
      <li>
        <span>Exact change</span>
        <span>{tally.exactChange}</span>
      </li>
      <li>
        <span>Wrong change</span>
        <span>{tally.wrongChange}</span>
      </li>
      <li>
        <span>Sloppy change</span>
        <span>{tally.sloppyChange}</span>
      </li>
      <li>
        <span>Wrong brand</span>
        <span>{tally.wrongBrand}</span>
      </li>
      <li>
        <span>Lookups used</span>
        <span>{tally.lookupsUsed}</span>
      </li>
      <li>
        <span>Drawer off by</span>
        <span>{formatYen(books.actual)}</span>
      </li>
      <li>
        <span>You declared</span>
        <span>{formatYen(books.declared)}</span>
      </li>
      <li>
        <span>Books</span>
        <span>{books.isBalanced ? 'Balanced' : `Out by ${formatYen(books.error)}`}</span>
      </li>
      <li>
        <span>Score</span>
        <span>{tally.score}</span>
      </li>
    </ul>
    <button type="button" className="primary" onClick={onRestart}>
      Another shift
    </button>
  </div>
)
