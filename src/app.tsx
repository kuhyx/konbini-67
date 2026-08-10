import { useCallback, useMemo, useReducer, useState, type JSX } from 'react'
import { STORE_NAME } from './core/catalog'
import { type Clock, realClock } from './core/clock'
import { requiresIdCheck } from './core/id-check'
import type { Point } from './core/layout'
import { canMakeChange, type Denom, purseCount, type Purse } from './core/money'
import { changeOwed, createShift, reduce } from './core/shift'
import {
  GAZE,
  GAZE_ORDER,
  type Gaze,
  type Resolution,
  RESOLUTION_ORDER,
  RESOLUTIONS,
} from './core/types'
import { Counter } from './ui/counter'
import { CounterTop } from './ui/counter-top'
import { PriceEntry } from './ui/price-entry'
import { Shelf } from './ui/shelf'
import { ShiftOver } from './ui/shift-over'
import { createSpeaker, type Speaker } from './ui/sound'
import { useSoundCues } from './ui/use-sound-cues'
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
   * Opening drawer. Injectable so a test can start from a till that cannot
   * make change without playing twenty customers to get there.
   */
  readonly float?: Purse
  /**
   * Where the noises go. Silent by default in tests, which is why this is
   * injected rather than reached for.
   */
  readonly speaker?: Speaker
}

export const App = ({ clock = realClock, float, speaker }: AppProperties = {}): JSX.Element => {
  const [seed, setSeed] = useState(FIRST_SEED)
  const [shiftNo, setShiftNo] = useState(1)
  const [state, dispatch] = useReducer(reduce, createShift(FIRST_SEED, 1, float))

  // One speaker for the life of the page. Built lazily so a test that passes
  // its own is never near a real `Audio` element.
  const sound = useMemo(() => speaker ?? createSpeaker(), [speaker])
  // Every noise the shop makes, derived from the state the reducer produced.
  useSoundCues(sound, {
    scanned: state.scanned,
    message: state.message,
    trayPieces: purseCount(state.tray),
  })

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
  const announce = useCallback((amount: number) => {
    dispatch({ kind: 'announce', amount })
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
  const sweep = useCallback((item: number, to: Point) => {
    dispatch({ kind: 'sweep', item, to })
  }, [])
  const askId = useCallback(() => {
    dispatch({ kind: 'ask-id' })
  }, [])
  const refuseSale = useCallback(() => {
    dispatch({ kind: 'refuse-sale' })
  }, [])

  if (state.phase === 'closed') {
    return (
      <div className="app">
        <ShiftOver tally={state.tally} onRestart={restart} />
      </div>
    )
  }

  const isChanging = state.phase === 'changing'
  const isAnnouncing = state.phase === 'announcing'
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
      {/*
        No live scoreboard. A real shop counter has a till, a customer and a
        clock — how the shift went is something you find out at the end.
      */}
      <header className="topbar">
        <div className="sign">
          {STORE_NAME}
          <small>KONBINI · SHIFT {shiftNo}</small>
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
          <>
            <Counter customer={state.customer} showTotal={isAnnouncing || isChanging} />
            <CounterTop
              goods={state.onCounter}
              cash={state.cashOnCounter}
              canScan={state.phase === 'scanning'}
              onSweep={sweep}
            />
            <Till
              tray={state.tray}
              drawer={state.drawer}
              enabled={isChanging}
              onGive={give}
              onTakeBack={takeBack}
            />
          </>
        ) : (
          <div className="panel looking-away">
            <h2>You&rsquo;re looking away</h2>
            <p className="hint">The customer and the counter are both behind you.</p>
          </div>
        )}

        {state.gaze === 'shelf' ? (
          <Shelf mode={state.shelf.mode} enabled={isShelf} lookupOpen={false} onPick={pick} />
        ) : undefined}
        {isLookingUp ? <WallClock elapsedMs={state.elapsedMs} /> : undefined}
      </div>

      <div className="actions">
        {isAnnouncing ? <PriceEntry onAnnounce={announce} /> : undefined}
        {isAnnouncing ? undefined : (
          <button
            type="button"
            className="primary"
            disabled={!isChanging}
            onClick={() => {
              dispatch({ kind: 'confirm' })
            }}
          >
            That&rsquo;s everything
          </button>
        )}
        {isShelf && state.shelf.mode !== 'labelled' ? (
          <button
            type="button"
            className="ghost"
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

export { SILENT } from './ui/sound'
