import { useCallback, useReducer, useState, type JSX } from 'react'
import { STORE_NAME } from './core/catalog'
import { type Clock, realClock } from './core/clock'
import type { Denom } from './core/money'
import { requiresIdCheck } from './core/id-check'
import { canMakeChange, type Purse } from './core/money'
import { reconcile, reconcilePoints, type Reconciliation } from './core/reconcile'
import { changeOwed, createShift, reduce, SHIFT_MS } from './core/shift'
import { type Notebook as NotebookState, writeNote } from './core/notebook'
import { loadNotebook, saveNotebook } from './core/notebook-storage'
import {
  GAZE,
  GAZE_ORDER,
  type Gaze,
  type Resolution,
  RESOLUTION_ORDER,
  RESOLUTIONS,
} from './core/types'
import { shiftEndsAt } from './core/wallclock'
import { Books } from './ui/books'
import { Counter } from './ui/counter'
import { Shelf } from './ui/shelf'
import { ShiftOver } from './ui/shift-over'
import { Notebook } from './ui/notebook'
import { Till } from './ui/till'
import { WallClock } from './ui/wall-clock'
import { useGameLoop } from './ui/use-game-loop'

/**
 * Seed for the opening shift; "Another shift" advances it.
 */
const FIRST_SEED = 1

export interface AppProperties {
  /**
   * Injectable so tests can run a shift to its end without real time.
   */
  readonly clock?: Clock
  /**
   * Where the notebook is kept. Injectable so a test can supply its own
   * rather than reaching for the real `localStorage`.
   */
  readonly storage?: Storage
  /**
   * Opening drawer. Injectable so a test can start from a till that cannot
   * make change without playing twenty customers to get there.
   */
  readonly float?: Purse
}

export const App = ({
  clock = realClock,
  storage = localStorage,
  float,
}: AppProperties = {}): JSX.Element => {
  const [seed, setSeed] = useState(FIRST_SEED)
  const [shiftNo, setShiftNo] = useState(1)
  const [state, dispatch] = useReducer(reduce, createShift(FIRST_SEED, 1, float))
  // Notes live outside ShiftState on purpose: they change what the player
  // knows, never what the shift does, so a seeded replay must not see them.
  const [notebook, setNotebook] = useState<NotebookState>(() => loadNotebook(storage))
  // The books are cashed up after the shift closes and before the summary.
  const [books, setBooks] = useState<Reconciliation | undefined>(undefined)

  const settle = useCallback((declared: number, actual: number) => {
    setBooks(reconcile(declared, actual))
  }, [])

  const writeSlotNote = useCallback(
    (slot: number, note: string) => {
      setNotebook((current) => {
        const next = writeNote(current, slot, note)
        saveNotebook(storage, next)
        return next
      })
    },
    [storage],
  )

  const onFrame = useCallback(
    (deltaMs: number) => {
      dispatch({ kind: 'tick', deltaMs })
    },
    [dispatch],
  )
  useGameLoop(clock, state.phase !== 'closed', onFrame)

  const restart = useCallback(() => {
    const next = seed + 1
    setSeed(next)
    setShiftNo((n) => n + 1)
    setBooks(undefined)
    dispatch({ kind: 'restart', seed: next, shift: shiftNo + 1 })
  }, [seed, shiftNo])

  const give = useCallback((denom: Denom) => {
    dispatch({ kind: 'give', denom })
  }, [])
  const takeBack = useCallback((denom: Denom) => {
    dispatch({ kind: 'take-back', denom })
  }, [])
  const pick = useCallback((slot: number) => {
    dispatch({ kind: 'pick-slot', slot })
  }, [])
  const look = useCallback((at: Gaze) => {
    dispatch({ kind: 'look', at })
  }, [])
  const resolve = useCallback((how: Resolution) => {
    dispatch({ kind: 'resolve', how })
  }, [])
  const askId = useCallback(() => {
    dispatch({ kind: 'ask-id' })
  }, [])
  const refuseSale = useCallback(() => {
    dispatch({ kind: 'refuse-sale' })
  }, [])

  if (state.phase === 'closed') {
    // Cash up first: the errors that never announced themselves during the
    // shift all land here at once, which is how a real till works.
    if (books === undefined) {
      return (
        <div className="app">
          <Books
            drawer={state.drawer}
            openingFloat={state.openingFloat}
            takings={state.takings}
            onSettle={settle}
          />
        </div>
      )
    }
    return (
      <div className="app">
        <ShiftOver
          tally={{ ...state.tally, score: state.tally.score + reconcilePoints(books) }}
          books={books}
          onRestart={restart}
        />
      </div>
    )
  }

  const isChanging = state.phase === 'changing'
  const isShelf = state.phase === 'shelf'
  const isLookingUp = state.gaze === 'clock'
  // Only surfaced when the till genuinely cannot pay out: a clerk does not
  // start negotiating over change they can simply hand over.
  const isStuck = isChanging && !canMakeChange(changeOwed(state), state.drawer)
  // The prompt is always available on a restricted basket; deciding whether
  // this particular customer needs asking is the player's call, not the
  // register's.
  const isRestricted = requiresIdCheck(state.customer)
  const canSeeCustomer = GAZE[state.gaze].canSeeCustomer

  return (
    <div className="app">
      <header className="topbar">
        <div className="sign">
          {STORE_NAME}
          <small>KONBINI · SHIFT {shiftNo}</small>
        </div>
        <div className="stats">
          <WallClock
            elapsedMs={state.elapsedMs}
            endsAt={shiftEndsAt(SHIFT_MS)}
            isLookingUp={isLookingUp}
          />
          <div className="stat">
            SERVED
            <b>{state.tally.served}</b>
          </div>
          <div className="stat">
            SCORE
            <b>{state.tally.score}</b>
          </div>
        </div>
      </header>

      <div className="message">
        <span>{state.message}</span>
        {isStuck ? (
          <span className="stuck">
            The till cannot make this change. You will have to say something.
          </span>
        ) : undefined}
      </div>

      <div className="grid">
        {canSeeCustomer ? (
          <Counter customer={state.customer} scanned={state.scanned} showTotal={isChanging} />
        ) : (
          <div className="panel looking-away">
            <h2>You&rsquo;re looking away</h2>
            <p className="hint">
              The customer, what they asked for and the receipt are all behind you.
            </p>
          </div>
        )}

        {state.gaze === 'shelf' ? (
          <Shelf mode={state.shelf.mode} enabled={isShelf} lookupOpen={false} onPick={pick} />
        ) : undefined}
        {state.gaze === 'notebook' ? (
          <Notebook notebook={notebook} onWrite={writeSlotNote} />
        ) : undefined}
        {state.gaze === 'counter' || state.gaze === 'clock' ? (
          <Till
            tray={state.tray}
            drawer={state.drawer}
            enabled={isChanging}
            onGive={give}
            onTakeBack={takeBack}
          />
        ) : undefined}
      </div>

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={isChanging || isShelf}
          onClick={() => {
            dispatch({ kind: 'scan' })
          }}
        >
          Scan item
        </button>
        <button
          type="button"
          className="primary"
          disabled={!isChanging}
          onClick={() => {
            dispatch({ kind: 'confirm' })
          }}
        >
          Hand over change
        </button>
        {isShelf && state.shelf.mode !== 'labelled' ? (
          <button
            type="button"
            className="ghost"
            disabled={state.gaze === 'notebook'}
            onClick={() => {
              dispatch({ kind: 'use-lookup' })
            }}
          >
            Check the chart (−{state.shelf.lookupPenalty})
          </button>
        ) : undefined}
        {isRestricted && state.idShown === undefined ? (
          <button type="button" className="ghost" onClick={askId}>
            Ask for ID
          </button>
        ) : undefined}
        <button type="button" className="ghost" onClick={refuseSale}>
          Refuse the sale
        </button>
        {isStuck
          ? RESOLUTION_ORDER.map((how) => (
              <button
                key={how}
                type="button"
                className="ghost"
                onClick={() => {
                  resolve(how)
                }}
              >
                {RESOLUTIONS[how].label}
              </button>
            ))
          : undefined}
        {GAZE_ORDER.map((at) =>
          at === state.gaze ? undefined : (
            <button
              key={at}
              type="button"
              className="ghost"
              onClick={() => {
                look(at)
              }}
            >
              {GAZE[at].label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
