import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PriceEntry } from './price-entry'

describe('PriceEntry', () => {
  it('says the number you typed', async () => {
    const onAnnounce = vi.fn()
    render(<PriceEntry onAnnounce={onAnnounce} />)
    await userEvent.type(screen.getByLabelText('Price to say out loud'), '894')
    await userEvent.click(screen.getByRole('button', { name: 'Say it' }))
    expect(onAnnounce).toHaveBeenCalledWith(894)
  })

  it('says the wrong number just as happily as the right one', async () => {
    // No validation on purpose: a form that refused a wrong price would be the
    // register correcting you, and then there is no mistake left to make.
    const onAnnounce = vi.fn()
    render(<PriceEntry onAnnounce={onAnnounce} />)
    await userEvent.type(screen.getByLabelText('Price to say out loud'), '984')
    await userEvent.click(screen.getByRole('button', { name: 'Say it' }))
    expect(onAnnounce).toHaveBeenCalledWith(984)
  })

  it('refuses to say nothing at all', () => {
    render(<PriceEntry onAnnounce={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Say it' })).toBeDisabled()
  })

  it('ignores anything that is not a digit', async () => {
    render(<PriceEntry onAnnounce={vi.fn()} />)
    const field = screen.getByLabelText('Price to say out loud')
    await userEvent.type(field, '8a9-4 ')
    expect(field).toHaveValue('894')
  })

  it('will not say zero', async () => {
    render(<PriceEntry onAnnounce={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Price to say out loud'), '0')
    expect(screen.getByRole('button', { name: 'Say it' })).toBeDisabled()
  })

  it('clears itself for the next customer', async () => {
    render(<PriceEntry onAnnounce={vi.fn()} />)
    const field = screen.getByLabelText('Price to say out loud')
    await userEvent.type(field, '500')
    await userEvent.click(screen.getByRole('button', { name: 'Say it' }))
    expect(field).toHaveValue('')
  })

  it('says nothing when you hit return on an empty field', () => {
    // The button is disabled here, but Enter still submits the form, so the
    // guard has to hold on its own.
    const onAnnounce = vi.fn()
    const { container } = render(<PriceEntry onAnnounce={onAnnounce} />)
    const form = container.querySelector('form')
    if (form === null) {
      throw new Error('no form rendered')
    }
    fireEvent.submit(form)
    expect(onAnnounce).not.toHaveBeenCalled()
  })

  it('can be said with the return key', async () => {
    const onAnnounce = vi.fn()
    render(<PriceEntry onAnnounce={onAnnounce} />)
    await userEvent.type(screen.getByLabelText('Price to say out loud'), '312{Enter}')
    expect(onAnnounce).toHaveBeenCalledWith(312)
  })
})
