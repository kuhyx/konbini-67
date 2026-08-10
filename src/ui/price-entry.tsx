import { useState, type JSX } from 'react'

export interface PriceEntryProperties {
  readonly onAnnounce: (amount: number) => void
}

/**
 * Saying the price out loud.
 *
 * You type the number yourself rather than pressing a button that reads it off
 * the register for you. The register is right there — this is not a memory
 * test — but transposing two digits under time pressure is a real thing that
 * real clerks do, and whether it costs you anything depends entirely on
 * whether this particular customer is listening.
 *
 * Deliberately no validation against the true total: a form that refuses the
 * wrong number would be the register correcting you, and then there would be
 * no mistake to make.
 */
export const PriceEntry = ({ onAnnounce }: PriceEntryProperties): JSX.Element => {
  const [typed, setTyped] = useState('')
  const amount = Number(typed)
  const isReady = typed.trim() !== '' && Number.isFinite(amount) && amount > 0

  return (
    <form
      className="price-entry"
      onSubmit={(event) => {
        // Enter reaches this even with an empty field, where the button is
        // disabled — so the guard is real, not belt-and-braces.
        event.preventDefault()
        if (!isReady) {
          return
        }
        onAnnounce(amount)
        setTyped('')
      }}
    >
      <label htmlFor="quoted">Tell them</label>
      <span className="yen-sign">¥</span>
      <input
        id="quoted"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={typed}
        aria-label="Price to say out loud"
        onChange={(event) => {
          // Digits only: you are saying a number, not writing an essay.
          setTyped(event.target.value.replaceAll(/\D/g, ''))
        }}
      />
      <button type="submit" className="primary" disabled={!isReady}>
        Say it
      </button>
    </form>
  )
}
