/**
 * The clerk's own cheat-sheet.
 *
 * A real konbini clerk who cannot remember which slot is Hi-Lite writes it on
 * a scrap of paper and tapes it inside the counter — and that scrap is still
 * there next shift. So notes persist, and they are authored by the player
 * rather than generated: nothing here knows the right answer.
 *
 * This deliberately sits outside `ShiftState`. Notes change what *you* know,
 * never what the shift does, so they must not reach the reducer — otherwise a
 * seeded replay would depend on what you happened to have written down.
 */

/**
 * Slot number → whatever the player typed for it.
 */
export type Notebook = Readonly<Record<number, string>>

export const EMPTY_NOTEBOOK: Notebook = {}

/**
 * Records (or clears) the note against one slot.
 *
 * Blank input removes the entry rather than storing an empty string, so a
 * cleared note is indistinguishable from one never written.
 */
export const writeNote = (notebook: Notebook, slot: number, note: string): Notebook => {
  const trimmed = note.trim()
  // Rebuilt rather than mutated-and-deleted: a cleared note simply does not
  // make it into the new record.
  const next: Record<number, string> = {}
  for (const [key, value] of Object.entries(notebook)) {
    if (Number(key) !== slot) {
      next[Number(key)] = value
    }
  }
  if (trimmed !== '') {
    next[slot] = trimmed
  }
  return next
}

/**
 * What the player wrote for a slot, if anything.
 */
export const readNote = (notebook: Notebook, slot: number): string | undefined => notebook[slot]

/**
 * Whether anything has been written down at all.
 */
export const isBlank = (notebook: Notebook): boolean => Object.keys(notebook).length === 0
