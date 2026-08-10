import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CASE_CAPACITY, type Cooking, HOT_ITEMS } from '../core/hotfood'

import { HotCase } from './hot-case'

const put = (what: Cooking['what'], startedMs: number, id: number): Cooking => ({
  what,
  startedMs,
  id,
})

describe('HotCase', () => {
  it('offers everything the shop can cook', () => {
    render(<HotCase cases={[]} nowMs={0} enabled onCook={vi.fn()} onTakeOut={vi.fn()} />)
    expect(screen.getByText(HOT_ITEMS.hotdog.label)).toBeInTheDocument()
    expect(screen.getByText(HOT_ITEMS['ice-cream'].label)).toBeInTheDocument()
  })

  it('says plainly that an empty case sells nothing', () => {
    render(<HotCase cases={[]} nowMs={0} enabled onCook={vi.fn()} onTakeOut={vi.fn()} />)
    expect(screen.getByText(/sells nothing while it is empty/)).toBeInTheDocument()
  })

  it('starts the thing you picked', async () => {
    const onCook = vi.fn()
    render(<HotCase cases={[]} nowMs={0} enabled onCook={onCook} onTakeOut={vi.fn()} />)
    await userEvent.click(screen.getByText(HOT_ITEMS.pizza.label))
    expect(onCook).toHaveBeenCalledWith('pizza')
  })

  it('shows what stage each portion is at', () => {
    const spec = HOT_ITEMS.hotdog
    const { container } = render(
      <HotCase
        cases={[put('hotdog', 0, 1), put('hotdog', spec.cookMs, 2)]}
        nowMs={spec.cookMs}
        enabled
        onCook={vi.fn()}
        onTakeOut={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('.portion.ready')).toHaveLength(1)
    expect(container.querySelectorAll('.portion.cooking')).toHaveLength(1)
  })

  it('marks what was left too long', () => {
    const spec = HOT_ITEMS.coffee
    const { container } = render(
      <HotCase
        cases={[put('coffee', 0, 1)]}
        nowMs={spec.cookMs + spec.graceMs}
        enabled
        onCook={vi.fn()}
        onTakeOut={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('.portion.ruined')).toHaveLength(1)
  })

  it('never shows a countdown', () => {
    // You read the case by looking at it, the same as everything else here.
    const { container } = render(
      <HotCase
        cases={[put('pizza', 0, 1)]}
        nowMs={5000}
        enabled
        onCook={vi.fn()}
        onTakeOut={vi.fn()}
      />,
    )
    const going = container.querySelector('.hot-going')
    expect(going?.textContent).not.toMatch(/\d/)
  })

  it('draws how far along a portion is', () => {
    const spec = HOT_ITEMS.pizza
    const { container } = render(
      <HotCase
        cases={[put('pizza', 0, 1)]}
        nowMs={spec.cookMs / 2}
        enabled
        onCook={vi.fn()}
        onTakeOut={vi.fn()}
      />,
    )
    const bar = container.querySelector<HTMLElement>('.portion-bar')
    expect(Number(bar?.style.getPropertyValue('--cooked'))).toBeCloseTo(0.5)
  })

  it('takes out the portion you clicked', async () => {
    const onTakeOut = vi.fn()
    const spec = HOT_ITEMS.coffee
    render(
      <HotCase
        cases={[put('coffee', 0, 7)]}
        nowMs={spec.cookMs}
        enabled
        onCook={vi.fn()}
        onTakeOut={onTakeOut}
      />,
    )
    await userEvent.click(screen.getByLabelText(/Hot Coffee, ready/))
    expect(onTakeOut).toHaveBeenCalledWith(7)
  })

  it('will not let you start anything once the case is full', () => {
    const full = Array.from({ length: CASE_CAPACITY }, (_, index) =>
      put('hotdog', 0, index),
    )
    const { container } = render(
      <HotCase cases={full} nowMs={0} enabled onCook={vi.fn()} onTakeOut={vi.fn()} />,
    )
    const starters = [...container.querySelectorAll<HTMLButtonElement>('.starter')]
    expect(starters.every((starter) => starter.disabled)).toBe(true)
  })

  it('is inert while your hands are busy', () => {
    const { container } = render(
      <HotCase
        cases={[put('coffee', 0, 1)]}
        nowMs={0}
        enabled={false}
        onCook={vi.fn()}
        onTakeOut={vi.fn()}
      />,
    )
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons.every((button) => button.disabled)).toBe(true)
  })
})
