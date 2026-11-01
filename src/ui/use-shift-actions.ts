import { type Dispatch, useCallback } from 'react'
import type { ItemId } from '../core/catalog'
import type { HotItem } from '../core/hotfood'
import type { Point } from '../core/layout'
import type { Denom } from '../core/money'
import type { Gaze, Resolution, ShiftEvent } from '../core/types'

/**
One stable callback per player action, each dispatching its shift event.
*/
export interface ShiftActions {
  readonly give: (denom: Denom) => void
  readonly takeBack: (denom: Denom) => void
  readonly announce: (amount: number) => void
  readonly pick: (slot: number) => void
  readonly look: (at: Gaze) => void
  readonly resolve: (how: Resolution) => void
  readonly sweep: (item: number, to: Point) => void
  readonly askId: () => void
  readonly refuseSale: () => void
  readonly doRestock: (item: ItemId) => void
  readonly turnAway: () => void
  readonly clean: (id: number) => void
  readonly cook: (what: HotItem) => void
  readonly takeOut: (id: number) => void
  readonly apologise: () => void
  readonly confirm: () => void
  readonly useLookup: () => void
}

export const useShiftActions = (dispatch: Dispatch<ShiftEvent>): ShiftActions => {
  const give = useCallback((denom: Denom) => {
    dispatch({ kind: 'give', denom })
  }, [dispatch])
  const takeBack = useCallback((denom: Denom) => {
    dispatch({ kind: 'take-back', denom })
  }, [dispatch])
  const announce = useCallback((amount: number) => {
    dispatch({ kind: 'announce', amount })
  }, [dispatch])
  const pick = useCallback((slot: number) => {
    dispatch({ kind: 'pick-slot', slot })
  }, [dispatch])
  const look = useCallback((at: Gaze) => {
    dispatch({ kind: 'look', at })
  }, [dispatch])
  const resolve = useCallback((how: Resolution) => {
    dispatch({ kind: 'resolve', how })
  }, [dispatch])
  const sweep = useCallback((item: number, to: Point) => {
    dispatch({ kind: 'sweep', item, to })
  }, [dispatch])
  const askId = useCallback(() => {
    dispatch({ kind: 'ask-id' })
  }, [dispatch])
  const refuseSale = useCallback(() => {
    dispatch({ kind: 'refuse-sale' })
  }, [dispatch])
  const doRestock = useCallback((item: ItemId) => {
    dispatch({ kind: 'restock', item })
  }, [dispatch])
  const turnAway = useCallback(() => {
    dispatch({ kind: 'turn-away' })
  }, [dispatch])
  const clean = useCallback((id: number) => {
    dispatch({ kind: 'clean', id })
  }, [dispatch])
  const cook = useCallback((what: HotItem) => {
    dispatch({ kind: 'cook', what })
  }, [dispatch])
  const takeOut = useCallback((id: number) => {
    dispatch({ kind: 'take-out', id })
  }, [dispatch])
  const apologise = useCallback(() => {
    dispatch({ kind: 'apologise' })
  }, [dispatch])
  const confirm = useCallback(() => {
    dispatch({ kind: 'confirm' })
  }, [dispatch])
  const useLookup = useCallback(() => {
    dispatch({ kind: 'use-lookup' })
  }, [dispatch])
  return { give, takeBack, announce, pick, look, resolve, sweep, askId, refuseSale, doRestock, turnAway, clean, cook, takeOut, apologise, confirm, useLookup }
}
