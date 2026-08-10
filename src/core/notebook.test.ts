import { describe, expect, it } from 'vitest'
import { EMPTY_NOTEBOOK, isBlank, type Notebook, readNote, writeNote } from './notebook'
import { loadNotebook, NOTEBOOK_KEY, saveNotebook } from './notebook-storage'

/**
 * A real (jsdom) `Storage`, seeded and cleared per call.
 *
 * Uses the genuine article rather than a hand-rolled double: `Storage` returns
 * `null` for a missing key, and reimplementing that contract would mean
 * writing `null` literals the project bans. `setup.ts` clears it after every
 * test, so nothing leaks between them.
 */
const fakeStorage = (seed: Record<string, string> = {}): Storage => {
  localStorage.clear()
  for (const [key, value] of Object.entries(seed)) {
    localStorage.setItem(key, value)
  }
  return localStorage
}

/**
 * A `Storage` whose writes always fail, like private mode or a full quota.
 */
const refusingStorage = (): Storage => {
  const real = fakeStorage()
  return {
    get length(): number {
      return real.length
    },
    clear: (): void => {
      real.clear()
    },
    getItem: (key: string): string | null => real.getItem(key),
    key: (index: number): string | null => real.key(index),
    removeItem: (key: string): void => {
      real.removeItem(key)
    },
    setItem: (): never => {
      throw new Error('QuotaExceededError')
    },
  }
}

describe('writeNote', () => {
  it('records a note against a slot', () => {
    const notebook = writeNote(EMPTY_NOTEBOOK, 5, 'Hi-Lite')
    expect(readNote(notebook, 5)).toBe('Hi-Lite')
  })

  it('overwrites an existing note', () => {
    let notebook = writeNote(EMPTY_NOTEBOOK, 5, 'Hi-Lite')
    notebook = writeNote(notebook, 5, 'Seven Stars')
    expect(readNote(notebook, 5)).toBe('Seven Stars')
  })

  it('trims surrounding whitespace', () => {
    expect(readNote(writeNote(EMPTY_NOTEBOOK, 3, ' Echo '), 3)).toBe('Echo')
  })

  it('clears the entry when given blank input', () => {
    let notebook = writeNote(EMPTY_NOTEBOOK, 5, 'Hi-Lite')
    notebook = writeNote(notebook, 5, ' '.repeat(3))
    expect(readNote(notebook, 5)).toBeUndefined()
    expect(isBlank(notebook)).toBe(true)
  })

  it('does not mutate the notebook it is given', () => {
    const before = writeNote(EMPTY_NOTEBOOK, 5, 'Hi-Lite')
    const after = writeNote(before, 7, 'Mevius')
    expect(readNote(before, 7)).toBeUndefined()
    expect(readNote(after, 5)).toBe('Hi-Lite')
  })

  it('leaves other slots alone when clearing one', () => {
    let notebook = writeNote(EMPTY_NOTEBOOK, 5, 'Hi-Lite')
    notebook = writeNote(notebook, 7, 'Mevius')
    notebook = writeNote(notebook, 5, '')
    expect(readNote(notebook, 7)).toBe('Mevius')
  })
})

describe('readNote', () => {
  it('is undefined for a slot never written', () => {
    expect(readNote(EMPTY_NOTEBOOK, 1)).toBeUndefined()
  })
})

describe('isBlank', () => {
  it('is true for a fresh notebook and false once written in', () => {
    expect(isBlank(EMPTY_NOTEBOOK)).toBe(true)
    expect(isBlank(writeNote(EMPTY_NOTEBOOK, 1, 'x'))).toBe(false)
  })
})

describe('notebook persistence', () => {
  it('round-trips a notebook through storage', () => {
    const storage = fakeStorage()
    const notebook = writeNote(EMPTY_NOTEBOOK, 5, 'Hi-Lite')
    saveNotebook(storage, notebook)
    expect(loadNotebook(storage)).toStrictEqual(notebook)
  })

  it('is empty when nothing was ever saved', () => {
    expect(loadNotebook(fakeStorage())).toStrictEqual(EMPTY_NOTEBOOK)
  })

  it('survives a corrupt entry rather than throwing', () => {
    const storage = fakeStorage({ [NOTEBOOK_KEY]: 'not json{' })
    expect(loadNotebook(storage)).toStrictEqual(EMPTY_NOTEBOOK)
  })

  it('rejects a stored value of the wrong shape', () => {
    for (const bad of ['null', '[]', '42', '"text"', '{"5":123}']) {
      const storage = fakeStorage({ [NOTEBOOK_KEY]: bad })
      expect(loadNotebook(storage)).toStrictEqual(EMPTY_NOTEBOOK)
    }
  })

  it('accepts a well-formed stored value', () => {
    const storage = fakeStorage({ [NOTEBOOK_KEY]: '{"5":"Hi-Lite"}' })
    const loaded: Notebook = loadNotebook(storage)
    expect(readNote(loaded, 5)).toBe('Hi-Lite')
  })

  it('ignores a storage that refuses to save', () => {
    // Private mode and a full quota both throw; a lost cheat-sheet must not
    // take the shift down with it.
    expect(() => {
      saveNotebook(refusingStorage(), writeNote(EMPTY_NOTEBOOK, 5, 'Hi-Lite'))
    }).not.toThrow()
  })
})
