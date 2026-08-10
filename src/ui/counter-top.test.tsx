import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ItemId } from '../core/catalog'
import { LASER_X, type Placed } from '../core/layout'
import type { Denom } from '../core/money'
import { CounterTop } from './counter-top'

const goods: readonly Placed<ItemId>[] = [
  { what: 'melonpan', at: { x: 0.1, y: 0.2 }, tilt: 5 },
  { what: 'beer', at: { x: 0.2, y: 0.6 }, tilt: -8 },
]

const cash: readonly Placed<Denom>[] = [
  { what: 1000, at: { x: 0.7, y: 0.3 }, tilt: 3 },
  { what: 100, at: { x: 0.8, y: 0.5 }, tilt: -2 },
  { what: 100, at: { x: 0.85, y: 0.4 }, tilt: 7 },
]

describe('CounterTop', () => {
  it('lays every loose item out to be scanned', () => {
    render(<CounterTop goods={goods} cash={[]} onSweep={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Scan Melonpan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Scan Beer/i })).toBeInTheDocument()
  })

  it('sweeps an item across the beam when you pass it', async () => {
    const onSweep = vi.fn()
    render(<CounterTop goods={goods} cash={[]} onSweep={onSweep} />)
    await userEvent.click(screen.getByRole('button', { name: /Scan Melonpan/i }))
    expect(onSweep).toHaveBeenCalledWith(0, { x: 0.95, y: 0.2 })
  })

  it('shows the customer cash as separate pieces, never a total', () => {
    render(<CounterTop goods={[]} cash={cash} onSweep={vi.fn()} />)
    // Two ¥100 coins appear as two coins, not as "¥200".
    expect(screen.getAllByText('¥100')).toHaveLength(2)
    expect(screen.getByText('¥1,000')).toBeInTheDocument()
    expect(screen.queryByText('¥1,200')).not.toBeInTheDocument()
  })

  it('positions each piece where it actually lies', () => {
    const { container } = render(<CounterTop goods={goods} cash={[]} onSweep={vi.fn()} />)
    const first = container.querySelector('.good')
    expect(first).toHaveStyle({ left: '10%', top: '20%' })
  })

  it('tilts pieces so a pile reads as a pile', () => {
    const { container } = render(<CounterTop goods={goods} cash={[]} onSweep={vi.fn()} />)
    expect(container.querySelector('.good')).toHaveStyle({ transform: 'rotate(5deg)' })
  })

  it('draws the beam where the arithmetic says it is', () => {
    const { container } = render(<CounterTop goods={[]} cash={[]} onSweep={vi.fn()} />)
    expect(container.querySelector('.laser')).toHaveStyle({ left: `${String(LASER_X * 100)}%` })
  })

  it('tells notes and coins apart', () => {
    const { container } = render(<CounterTop goods={[]} cash={cash} onSweep={vi.fn()} />)
    expect(container.querySelectorAll('.note')).toHaveLength(1)
    expect(container.querySelectorAll('.coin')).toHaveLength(2)
  })

  it('renders an empty counter without complaint', () => {
    const { container } = render(<CounterTop goods={[]} cash={[]} onSweep={vi.fn()} />)
    expect(container.querySelectorAll('.good')).toHaveLength(0)
  })
})
