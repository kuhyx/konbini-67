import { useCallback, useReducer, useState, type JSX } from 'react'
import { STORE_NAME } from './core/catalog'
import { type Clock, realClock } from './core/clock'
import type { Denom } from './core/money'
import { createShift, reduce, SHIFT_MS } from './core/shift'
import { Counter } from './ui/counter'
import { Shelf } from './ui/shelf'
import { ShiftOver } from './ui/shift-over'
import { Till } from './ui/till'
import { useGameLoop } from './ui/use-game-loop'

/**
 * Seed for the opening shift; "Another shift" advances it.
 */
const FIRST_SEED = 1

const clampSeconds = (ms: number): string => String(Math.max(0, Math.ceil(ms / 1000)))

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

  if (state.phase === 'closed') {
    return (
      <div className="app">
        <ShiftOver tally={state.tally} onRestart={restart} />
      </div>
    )
  }

  const isChanging = state.phase === 'changing'
  const isShelf = state.phase === 'shelf'

  return (
    <div className="app">
      <header className="topbar">
        <div className="sign">
          {STORE_NAME}
          <small>KONBINI · SHIFT {shiftNo}</small>
        </div>
        <div className="stats">
          <div className="stat">
            TIME
            <b>{clampSeconds(SHIFT_MS - state.elapsedMs)}s</b>
          </div>
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
        <Counter customer={state.customer} scanned={state.scanned} showTotal={isChanging} />

        {isShelf ? (
          <Shelf
            mode={state.shelf.mode}
            enabled
            lookupOpen={state.lookupOpen}
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
            disabled={state.lookupOpen}
            onClick={() => {
              dispatch({ kind: 'use-lookup' })
            }}
          >
            Check the chart (−{state.shelf.lookupPenalty})
          </button>
        ) : undefined}
      </div>
    </div>
  )
}
