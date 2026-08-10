import { useCallback, useReducer, useState, type JSX } from 'react'
import { STORE_NAME } from './core/catalog'
import { type Clock, realClock } from './core/clock'
import type { Denom } from './core/money'
import { createShift, reduce, SHIFT_MS } from './core/shift'
import { type Notebook as NotebookState, writeNote } from './core/notebook'
import { loadNotebook, saveNotebook } from './core/notebook-storage'
import { GAZE, GAZE_ORDER, type Gaze } from './core/types'
import { shiftEndsAt } from './core/wallclock'
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
}

export const App = ({
  clock = realClock,
  storage = localStorage,
}: AppProperties = {}): JSX.Element => {
  const [seed, setSeed] = useState(FIRST_SEED)
  const [shiftNo, setShiftNo] = useState(1)
  const [state, dispatch] = useReducer(reduce, createShift(FIRST_SEED, 1))
  // Notes live outside ShiftState on purpose: they change what the player
  // knows, never what the shift does, so a seeded replay must not see them.
  const [notebook, setNotebook] = useState<NotebookState>(() => loadNotebook(storage))

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

  if (state.phase === 'closed') {
    return (
      <div className="app">
        <ShiftOver tally={state.tally} onRestart={restart} />
      </div>
    )
  }

  const isChanging = state.phase === 'changing'
  const isShelf = state.phase === 'shelf'
  const isLookingUp = state.gaze === 'clock'
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
          <Till tray={state.tray} enabled={isChanging} onGive={give} onTakeBack={takeBack} />
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
