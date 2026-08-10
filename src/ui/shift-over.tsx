import type { JSX } from 'react'
import { formatYen } from '../core/money'
import { gradeForShift } from '../core/score'
import type { ShiftTally } from '../core/types'

export interface ShiftOverProperties {
  readonly tally: ShiftTally
  readonly onRestart: () => void
}

export const ShiftOver = ({ tally, onRestart }: ShiftOverProperties): JSX.Element => (
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
        <span>Wrong price said</span>
        <span>{tally.misquoted}</span>
      </li>
      <li>
        <span>Walked out</span>
        <span>{tally.walkedOut}</span>
      </li>
      <li>
        <span>Sales lost to empty shelves</span>
        <span>{tally.lostSales}</span>
      </li>
      <li>
        <span>Restocked</span>
        <span>{tally.restocked}</span>
      </li>
      <li>
        <span>Cleaned up</span>
        <span>{tally.cleaned}</span>
      </li>
      <li>
        <span>Hot food sold</span>
        <span>{tally.hotSold}</span>
      </li>
      <li>
        <span>Thrown away</span>
        <span>{tally.binned}</span>
      </li>
      <li>
        <span>Drawer off by</span>
        <span>{formatYen(tally.drawerDelta)}</span>
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
