import { describe, expect, it } from 'vitest'
import {
  CASE_CAPACITY,
  type Cooking,
  cookProgress,
  countOf,
  HOT_ITEM_ORDER,
  HOT_ITEMS,
  oldestReady,
  remove,
  ruined,
  stageOf,
} from './hotfood'

const put = (what: Cooking['what'], startedMs: number, id: number): Cooking => ({
  what,
  startedMs,
  id,
})

describe('HOT_ITEMS', () => {
  it('describes everything that can be cooked', () => {
    for (const item of HOT_ITEM_ORDER) {
      expect(HOT_ITEMS[item].label).not.toBe('')
      expect(HOT_ITEMS[item].price).toBeGreaterThan(0)
    }
  })

  it('gives the quick things the shortest cook', () => {
    // Coffee and soft serve ship first as the cheap proof the plumbing works.
    expect(HOT_ITEMS.coffee.cookMs).toBeLessThan(HOT_ITEMS.hotdog.cookMs)
    expect(HOT_ITEMS['ice-cream'].cookMs).toBeLessThan(HOT_ITEMS.pizza.cookMs)
  })

  it('gives everything a window where it is worth selling', () => {
    for (const item of HOT_ITEM_ORDER) {
      expect(HOT_ITEMS[item].graceMs).toBeGreaterThan(0)
    }
  })
})

describe('stageOf', () => {
  const hotdog = put('hotdog', 0, 1)
  const spec = HOT_ITEMS.hotdog

  it('is cooking until it is done', () => {
    expect(stageOf(hotdog, 0)).toBe('cooking')
    expect(stageOf(hotdog, spec.cookMs - 1)).toBe('cooking')
  })

  it('is ready the instant it is done', () => {
    expect(stageOf(hotdog, spec.cookMs)).toBe('ready')
  })

  it('stays good for its grace window', () => {
    expect(stageOf(hotdog, spec.cookMs + spec.graceMs - 1)).toBe('ready')
  })

  it('is ruined once the window closes', () => {
    // The timer does not pause for the queue: this is what happens while you
    // are busy with somebody else.
    expect(stageOf(hotdog, spec.cookMs + spec.graceMs)).toBe('ruined')
  })

  it('never goes backwards', () => {
    let seen = 0
    const order = ['cooking', 'ready', 'ruined']
    for (let now = 0; now < spec.cookMs + spec.graceMs + 5000; now += 250) {
      const index = order.indexOf(stageOf(hotdog, now))
      expect(index).toBeGreaterThanOrEqual(seen)
      seen = index
    }
  })
})

describe('cookProgress', () => {
  it('runs from nothing to full', () => {
    const pizza = put('pizza', 0, 1)
    expect(cookProgress(pizza, 0)).toBe(0)
    expect(cookProgress(pizza, HOT_ITEMS.pizza.cookMs / 2)).toBeCloseTo(0.5)
    expect(cookProgress(pizza, HOT_ITEMS.pizza.cookMs)).toBe(1)
  })

  it('clamps rather than running past the end', () => {
    const pizza = put('pizza', 0, 1)
    expect(cookProgress(pizza, HOT_ITEMS.pizza.cookMs * 3)).toBe(1)
    expect(cookProgress(put('pizza', 5000, 1), 0)).toBe(0)
  })
})

describe('countOf', () => {
  it('counts one kind, ignoring the rest', () => {
    const cases = [put('hotdog', 0, 1), put('hotdog', 100, 2), put('pizza', 0, 3)]
    expect(countOf(cases, 'hotdog')).toBe(2)
    expect(countOf(cases, 'coffee')).toBe(0)
  })
})

describe('ruined', () => {
  it('finds what was left too long', () => {
    const spec = HOT_ITEMS.coffee
    const cases = [put('coffee', 0, 1), put('coffee', 100_000, 2)]
    const spoiled = ruined(cases, spec.cookMs + spec.graceMs + 1)
    expect(spoiled).toHaveLength(1)
    expect(spoiled[0]?.id).toBe(1)
  })

  it('is empty when everything is fresh', () => {
    expect(ruined([put('hotdog', 0, 1)], 0)).toStrictEqual([])
  })
})

describe('oldestReady', () => {
  it('hands over what was cooked first', () => {
    // First cooked, first sold, or the case slowly fills with old stock.
    const spec = HOT_ITEMS.hotdog
    const cases = [put('hotdog', 1000, 2), put('hotdog', 0, 1)]
    expect(oldestReady(cases, 'hotdog', spec.cookMs + 2000)?.id).toBe(1)
  })

  it('ignores anything still cooking', () => {
    expect(oldestReady([put('hotdog', 0, 1)], 'hotdog', 100)).toBeUndefined()
  })

  it('ignores anything ruined', () => {
    const spec = HOT_ITEMS.hotdog
    const late = spec.cookMs + spec.graceMs + 1
    expect(oldestReady([put('hotdog', 0, 1)], 'hotdog', late)).toBeUndefined()
  })

  it('is undefined when the case holds nothing of that kind', () => {
    expect(oldestReady([put('pizza', 0, 1)], 'hotdog', 999_999)).toBeUndefined()
  })
})

describe('remove', () => {
  it('takes exactly one portion out', () => {
    const cases = [put('hotdog', 0, 1), put('pizza', 0, 2)]
    expect(remove(cases, 1)).toHaveLength(1)
    expect(remove(cases, 1)[0]?.what).toBe('pizza')
  })

  it('leaves the case alone for an id that is not in it', () => {
    const cases = [put('hotdog', 0, 1)]
    expect(remove(cases, 99)).toStrictEqual(cases)
  })
})

describe('CASE_CAPACITY', () => {
  it('is small enough that the case needs watching', () => {
    // Without a cap the winning move is to fill the roller once and never
    // think about it again, which is the opposite of a timer you watch.
    expect(CASE_CAPACITY).toBeLessThanOrEqual(8)
  })
})
