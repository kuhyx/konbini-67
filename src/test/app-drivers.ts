/**
Drivers for the App tests: play the counter the way a player would.
*/

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { asSurface, dragOn } from './drag'

/**
Turns to the shelf and picks a slot, if this customer wanted cigarettes.

The shelf is no longer on screen by default — reaching it is a head-turn,
so every test that gets past a cigarette request has to make that turn the
same way a player would.
*/
export const handleCigarettesIfAsked = async (): Promise<void> => {
  const turn = screen.queryByRole('button', { name: /Turn to the shelf/i })
  if (turn === null) {
    return
  }
  await userEvent.click(turn)
  const slot = screen.queryByLabelText('Slot 3')
  if (slot !== null && !(slot as HTMLButtonElement).disabled) {
    await userEvent.click(slot)
  }
  const back = screen.queryByRole('button', { name: /Back to the counter/i })
  if (back !== null) {
    await userEvent.click(back)
  }
}

/**
The counter surface, prepared so pointer drags land where the test aims.
*/
export const surface = (): HTMLElement => {
  const node = document.querySelector('.counter-top')
  if (node === null) {
    throw new Error('the counter is not on screen')
  }
  return asSurface(node as HTMLElement)
}

/**
How many loose things are currently on the counter.
*/
export const looseGoods = (): number => document.querySelectorAll('.good').length

/**
Rings up every item, whatever the basket happens to hold.

Each one is physically swept over the beam. A successful sweep takes that
item off the counter, so the pile is re-read every pass rather than cached.
*/
export const scanEverything = (): void => {
  for (let n = 0; n < 14; n += 1) {
    const [first] = [...document.querySelectorAll('.good')]
    if (first === undefined) {
      return
    }
    const at = unitOf(first as HTMLElement)
    dragOn(surface(), at, { x: 0.95, y: at.y })
  }
}

/**
Where a rendered piece sits, read back out of its inline percentages.

The component positions everything from the game's own unit coordinates, so
this recovers the point a drag has to start from to grab it.
*/
export const unitOf = (node: HTMLElement): { x: number; y: number } => ({
  x: Number(node.style.left.replace('%', '')) / 100,
  y: Number(node.style.top.replace('%', '')) / 100,
})

/**
Says the total out loud, which is what puts the customer's money down.
*/
export const announceTotal = async (amount?: number): Promise<void> => {
  const field = screen.queryByLabelText('Price to say out loud')
  if (field === null) {
    return
  }
  // Read the true total off the register unless the test wants it wrong.
  // Scoped to the register itself: the customer's loose cash is on screen too
  // and looks exactly like a price.
  const shown = document.querySelector('.register-total')
  const correct = Number((shown?.textContent ?? '0').replaceAll(/\D/g, ''))
  await userEvent.type(field, String(amount ?? correct))
  await userEvent.click(screen.getByRole('button', { name: 'Say it' }))
}

/**
Rings everything up, fetches any cigarettes, and announces the price.
*/
export const ringUpAndAnnounce = async (): Promise<void> => {
  scanEverything()
  await handleCigarettesIfAsked()
  // The packet is on the counter now and still has to go over the beam.
  scanEverything()
  await announceTotal()
}

/**
Takes one piece out of the drawer and pushes it across to the customer.
*/
export const handOver = async (): Promise<void> => {
  await userEvent.click(screen.getByLabelText('Give ¥100'))
}
