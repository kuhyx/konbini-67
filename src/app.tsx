import { useCallback, useMemo, useReducer, useState, type JSX } from 'react'
import { type ItemId, STORE_NAME } from './core/catalog'
import { type Clock, realClock } from './core/clock'
import { requiresIdCheck } from './core/id-check'
import type { Point } from './core/layout'
import { canMakeChange, type Denom, purseCount, type Purse } from './core/money'
import { changeOwed, createShift, missingFromBasket, reduce } from './core/shift'
import type { Stock } from './core/stock'
import { GAZE, type Gaze, type Resolution } from './core/types'
import { Counter } from './ui/counter'
import { CounterTop } from './ui/counter-top'
import { ActionBar } from './ui/action-bar'
import { Shelf } from './ui/shelf'
import { Stockroom } from './ui/stockroom'
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
  /**
   * Opening shelf stock. Injectable for the same reason as `float`: an empty
   * shelf is otherwise reachable only by selling six of something first.
   */
  readonly stock?: Stock
}

export const App = ({
  clock = realClock,
  float,
  speaker,
  stock,
}: AppProperties = {}): JSX.Element => {
  const [seed, setSeed] = useState(FIRST_SEED)
  const [shiftNo, setShiftNo] = useState(1)
  const [state, dispatch] = useReducer(reduce, {
    ...createShift(FIRST_SEED, 1, float),
    ...(stock && { stock }),
  })

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
  const doRestock = useCallback((item: ItemId) => {
    dispatch({ kind: 'restock', item })
  }, [])
  const turnAway = useCallback(() => {
    dispatch({ kind: 'turn-away' })
  }, [])
  const clean = useCallback((id: number) => {
    dispatch({ kind: 'clean', id })
  }, [])
  const confirm = useCallback(() => {
    dispatch({ kind: 'confirm' })
  }, [])
  const useLookup = useCallback(() => {
    dispatch({ kind: 'use-lookup' })
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
  // Restocking is a thing you do instead of serving, so it is only offered
  // when nobody is mid-transaction and the clock is not already frozen.
  const canRestock = state.phase === 'scanning' && state.elapsedMs >= state.frozenUntilMs
  // What this customer wants that the shop has not got. Non-empty means the
  // sale cannot be completed however well the arithmetic goes.
  const missing = missingFromBasket(state)
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
              messes={state.messes}
              onClean={clean}
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
        {state.gaze === 'stockroom' ? (
          <Stockroom stock={state.stock} enabled={canRestock} onRestock={doRestock} />
        ) : undefined}
      </div>

      <ActionBar
        phase={state.phase}
        gaze={state.gaze}
        shelfMode={state.shelf.mode}
        lookupPenalty={state.shelf.lookupPenalty}
        canAskId={isRestricted && state.idShown === undefined}
        isStuck={isStuck}
        isUnfillable={missing.length > 0}
        onAnnounce={announce}
        onConfirm={confirm}
        onLookup={useLookup}
        onAskId={askId}
        onRefuse={refuseSale}
        onTurnAway={turnAway}
        onResolve={resolve}
        onLook={look}
      />
    </div>
  )
}

export { SILENT } from './ui/sound'
