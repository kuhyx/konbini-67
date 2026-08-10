import { describe, expect, it } from 'vitest'
import {
  CIGARETTE_ORDER,
  CIGARETTES,
  ITEM_ORDER,
  ITEMS,
  SHELF_SLOTS,
  SLOT_TO_CIGARETTE,
  STORE_NAME,
} from './catalog'

describe('catalog', () => {
  it('keeps the joke name', () => {
    expect(STORE_NAME).toBe('6/7')
  })

  // One loop covers every entry — a new item is covered the moment it is added.
  it.each(ITEM_ORDER)('item %s is well formed', (id) => {
    const spec = ITEMS[id]
    expect(spec.label.length).toBeGreaterThan(0)
    expect(spec.emoji.length).toBeGreaterThan(0)
    expect(spec.price).toBeGreaterThan(0)
    expect(Number.isSafeInteger(spec.price)).toBe(true)
    expect(typeof spec.ageRestricted).toBe('boolean')
  })

  it('covers every item id exactly once', () => {
    expect(new Set(ITEM_ORDER).size).toBe(ITEM_ORDER.length)
    expect(ITEM_ORDER).toHaveLength(Object.keys(ITEMS).length)
  })

  it('has at least one age-restricted item', () => {
    expect(ITEM_ORDER.some((id) => ITEMS[id].ageRestricted)).toBe(true)
  })

  it.each(CIGARETTE_ORDER)('cigarette %s is well formed', (id) => {
    const spec = CIGARETTES[id]
    expect(spec.label.length).toBeGreaterThan(0)
    expect(spec.price).toBeGreaterThan(0)
    expect(spec.slot).toBeGreaterThan(0)
    expect(spec.slot).toBeLessThanOrEqual(SHELF_SLOTS.length)
  })

  it('gives every brand a unique slot', () => {
    const slots = CIGARETTE_ORDER.map((id) => CIGARETTES[id].slot)
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('derives the slot lookup from the brand table', () => {
    for (const id of CIGARETTE_ORDER) {
      expect(SLOT_TO_CIGARETTE.get(CIGARETTES[id].slot)).toBe(id)
    }
    expect(SLOT_TO_CIGARETTE.size).toBe(CIGARETTE_ORDER.length)
  })

  it('leaves empty gaps on the wall', () => {
    // The gaps are the point: a full wall would be trivial to memorise.
    expect(SHELF_SLOTS.length).toBeGreaterThan(CIGARETTE_ORDER.length)
    expect(SHELF_SLOTS[0]).toBe(1)
  })

  it('has no slot outside the wall', () => {
    for (const slot of SLOT_TO_CIGARETTE.keys()) {
      expect(SHELF_SLOTS).toContain(slot)
    }
  })
})
