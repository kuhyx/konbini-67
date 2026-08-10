import { useCallback, useReducer, useState, type JSX } from 'react'
import { STORE_NAME } from './core/catalog'
import { type Clock, realClock } from './core/clock'
import type { Denom } from './core/money'
import { createShift, reduce, SHIFT_MS } from './core/shift'
import { GAZE, type Gaze } from './core/types'
import { shiftEndsAt } from './core/wallclock'
import { Counter } from './ui/counter'
import { Shelf } from './ui/shelf'
import { ShiftOver } from './ui/shift-over'
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
}

export const App = ({ clock = realClock }: AppProperties = {}): JSX.Element => {
  const [seed, setSeed] = useState(FIRST_SEED)
  const [shiftNo, setShiftNo] = useState(1)
  const [state, dispatch] = useReducer(reduce, createShift(FIRST_SEED, 1))

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

        {isShelf ? (
          <Shelf
            mode={state.shelf.mode}
            enabled
            lookupOpen={state.gaze === 'notebook'}
            onPick={pick}
          />
        ) : (
          <Till tray={state.tray} enabled={isChanging} onGive={give} onTakeBack={takeBack} />
        )}
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
        <button
          type="button"
          className="ghost"
          onClick={() => {
            look(isLookingUp ? 'counter' : 'clock')
          }}
        >
          {isLookingUp ? GAZE.counter.label : GAZE.clock.label}
        </button>
      </div>
    </div>
  )
}
