/**
 * Persistence for the clerk's notebook.
 *
 * Split from `notebook.ts` so that module stays pure and free of browser
 * globals. Everything here fails soft: a notebook that cannot be read is an
 * empty notebook, and one that cannot be saved is simply not saved. Losing a
 * cheat-sheet must never take the shift down with it.
 */

import { EMPTY_NOTEBOOK, type Notebook } from './notebook'

export const NOTEBOOK_KEY = 'konbini67.notebook'

/**
 * Whether a parsed value is a slot→note record.
 *
 * `JSON.parse` returns `any`, and a stale or hand-edited entry could hold
 * anything, so the shape is checked rather than trusted.
 */
const isNotebook = (value: unknown): value is Notebook => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every((note) => typeof note === 'string')
}

/**
 * Reads the saved notebook, or an empty one if there is nothing usable.
 */
export const loadNotebook = (storage: Storage): Notebook => {
  const raw = storage.getItem(NOTEBOOK_KEY)
  if (raw === null) {
    return EMPTY_NOTEBOOK
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isNotebook(parsed) ? parsed : EMPTY_NOTEBOOK
  } catch {
    // Corrupt entry: start fresh rather than crash into a blank screen.
    return EMPTY_NOTEBOOK
  }
}

/**
 * Saves the notebook, ignoring a storage that refuses to take it.
 *
 * Private-mode and quota-exceeded both throw on write; neither is worth
 * interrupting a shift over.
 */
export const saveNotebook = (storage: Storage, notebook: Notebook): void => {
  try {
    storage.setItem(NOTEBOOK_KEY, JSON.stringify(notebook))
  } catch {
    // Nothing to do — the notes just will not survive this session.
  }
}
