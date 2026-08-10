import type { JSX } from 'react'
import { SHELF_SLOTS } from '../core/catalog'
import { type Notebook as NotebookState, readNote } from '../core/notebook'

export interface NotebookProperties {
  readonly notebook: NotebookState
  readonly onWrite: (slot: number, note: string) => void
}

/**
 * The scrap of paper taped inside the counter.
 *
 * Deliberately empty until the player fills it in — nothing here knows which
 * brand is in which slot, so writing "5 = Hi-Lite" means having learned it at
 * the shelf and carried it back. Checking it is a head-turn like any other, so
 * the customer is out of view while you read your own handwriting.
 */
export const Notebook = ({ notebook, onWrite }: NotebookProperties): JSX.Element => (
  <div className="panel notebook">
    <h2>Your notes</h2>
    <p className="hint">Whatever you write here is still here next shift.</p>
    <ul className="notes">
      {SHELF_SLOTS.map((slot) => (
        <li key={slot}>
          <label htmlFor={`note-${String(slot)}`}>{slot}</label>
          <input
            id={`note-${String(slot)}`}
            type="text"
            value={readNote(notebook, slot) ?? ''}
            placeholder="—"
            aria-label={`Note for slot ${String(slot)}`}
            onChange={(event) => {
              onWrite(slot, event.target.value)
            }}
          />
        </li>
      ))}
    </ul>
  </div>
)
