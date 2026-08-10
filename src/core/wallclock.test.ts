import { describe, expect, it } from 'vitest'
import { SHIFT_MS } from './shift'
import {
  clockAt,
  formatClock,
  SHIFT_START_MINUTES,
  shiftEndsAt,
  SHOP_SECONDS_PER_REAL_MS,
} from './wallclock'

describe('formatClock', () => {
  it('pads both fields to two digits', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(9 * 60 + 5)).toBe('09:05')
  })

  it('renders afternoon times on a 24-hour dial', () => {
    expect(formatClock(22 * 60)).toBe('22:00')
    expect(formatClock(23 * 60 + 59)).toBe('23:59')
  })

  it('wraps past midnight, because a closing shift crosses it', () => {
    expect(formatClock(24 * 60)).toBe('00:00')
    expect(formatClock(25 * 60 + 30)).toBe('01:30')
  })

  it('wraps negative minutes back into the day', () => {
    expect(formatClock(-30)).toBe('23:30')
  })
})

describe('clockAt', () => {
  it('starts the shift at its opening time', () => {
    expect(formatClock(clockAt(0))).toBe('22:00')
  })

  it('runs 22:00 to 23:00 across a full shift', () => {
    expect(formatClock(clockAt(SHIFT_MS))).toBe('23:00')
  })

  it('advances a quarter of an hour per quarter of the shift', () => {
    const quarter = clockAt(SHIFT_MS / 4)
    const half = clockAt(SHIFT_MS / 2)
    expect(formatClock(quarter)).toBe('22:15')
    expect(formatClock(half)).toBe('22:30')
  })

  it('truncates to whole minutes, so seconds never tick on screen', () => {
    // Two readings inside the same shop minute must show the same time.
    const oneShopMinute = (60 / SHOP_SECONDS_PER_REAL_MS) * 1000
    expect(clockAt(0)).toBe(clockAt(oneShopMinute - 1))
    expect(clockAt(oneShopMinute)).toBe(clockAt(0) + 1)
  })

  it('never runs backwards as the shift progresses', () => {
    let previous = clockAt(0)
    for (let ms = 0; ms <= SHIFT_MS; ms += 1000) {
      const current = clockAt(ms)
      expect(current).toBeGreaterThanOrEqual(previous)
      previous = current
    }
  })

  it('accepts a different opening time', () => {
    expect(formatClock(clockAt(0, 6 * 60))).toBe('06:00')
    expect(formatClock(clockAt(SHIFT_MS, 6 * 60))).toBe('07:00')
  })
})

describe('shiftEndsAt', () => {
  it('is the clock reading at the end of the shift', () => {
    expect(shiftEndsAt(SHIFT_MS)).toBe(clockAt(SHIFT_MS))
    expect(formatClock(shiftEndsAt(SHIFT_MS))).toBe('23:00')
  })

  it('follows a custom opening time', () => {
    expect(formatClock(shiftEndsAt(SHIFT_MS, 6 * 60))).toBe('07:00')
  })

  it('opens at the documented hour', () => {
    expect(formatClock(SHIFT_START_MINUTES)).toBe('22:00')
  })
})
