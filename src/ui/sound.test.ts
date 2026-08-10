import { describe, expect, it, vi } from 'vitest'
import { type Audible, createSpeaker, cuesFor, SILENT } from './sound'

const quiet: Audible = {
  scanned: 0,
  message: '',
  trayPieces: 0,
  cooking: 0,
  ready: 0,
  binned: 0,
  restocked: 0,
  cleaned: 0,
  impatient: false,
}

/**
 * A stand-in for an audio element that records what was asked of it.
 */
const fakeAudio = (): { element: HTMLAudioElement; played: () => number } => {
  let plays = 0
  const element = {
    preload: '',
    volume: 0,
    play: (): Promise<void> => {
      plays += 1
      return Promise.resolve()
    },
    cloneNode: (): HTMLAudioElement => element,
  } as unknown as HTMLAudioElement
  return { element, played: () => plays }
}

describe('cuesFor', () => {
  it('beeps when something is rung up', () => {
    expect(cuesFor(quiet, { ...quiet, scanned: 1 })).toStrictEqual(['beep'])
  })

  it('says nothing when nothing changed', () => {
    expect(cuesFor(quiet, quiet)).toStrictEqual([])
  })

  it('clinks when a coin comes out of the drawer', () => {
    expect(cuesFor(quiet, { ...quiet, trayPieces: 1 })).toStrictEqual(['coin'])
  })

  it('stays quiet when a coin goes back in', () => {
    expect(cuesFor({ ...quiet, trayPieces: 2 }, { ...quiet, trayPieces: 1 })).toStrictEqual([])
  })

  it('buzzes on a sweep that missed the beam', () => {
    expect(cuesFor(quiet, { ...quiet, message: 'No beep. Try again.' })).toStrictEqual(['reject'])
  })

  it('opens the drawer when the customer pays', () => {
    const after = { ...quiet, message: '“¥500, please.” They put their money down.' }
    expect(cuesFor(quiet, after)).toStrictEqual(['drawer'])
  })

  it('opens the drawer for a misquote they did not notice', () => {
    const after = { ...quiet, message: '“¥900, please.” They pay it without looking up.' }
    expect(cuesFor(quiet, after)).toStrictEqual(['drawer'])
  })

  it('ignores a message that is not about money or a miss', () => {
    expect(cuesFor(quiet, { ...quiet, message: 'Ring up the items.' })).toStrictEqual([])
  })

  it('can fire more than one cue at once', () => {
    const after = { ...quiet, scanned: 1, trayPieces: 1, message: 'No beep. Try again.' }
    expect(cuesFor(quiet, after)).toStrictEqual(['beep', 'coin', 'reject'])
  })

  it('sizzles when a portion goes on the roller', () => {
    expect(cuesFor(quiet, { ...quiet, cooking: 1 })).toStrictEqual(['cook'])
  })

  it('chimes when a portion comes good', () => {
    // The cue that earns its keep: the case is behind you. The portion was
    // already on the roller, so only `ready` moves — it does not go on again.
    const onTheRoller = { ...quiet, cooking: 1 }
    expect(cuesFor(onTheRoller, { ...onTheRoller, ready: 1 })).toStrictEqual(['ready'])
  })

  it('stays quiet when a ready portion is taken out', () => {
    // Selling one lowers both counts, and neither drop is an event.
    const before = { ...quiet, cooking: 1, ready: 1 }
    expect(cuesFor(before, quiet)).toStrictEqual([])
  })

  it('stays quiet when a ready portion spoils instead', () => {
    // `ready` falls and `cooking` holds: the portion is still in the case,
    // just ruined. The bin noise belongs to throwing it out, not to this.
    const before = { ...quiet, cooking: 1, ready: 1 }
    expect(cuesFor(before, { ...quiet, cooking: 1 })).toStrictEqual([])
  })

  it('thumps when something goes in the bin', () => {
    expect(cuesFor(quiet, { ...quiet, binned: 1 })).toStrictEqual(['burn'])
  })

  it('rattles when the shelf is refilled', () => {
    expect(cuesFor(quiet, { ...quiet, restocked: 1 })).toStrictEqual(['stock'])
  })

  it('wipes when a mess is cleaned up', () => {
    expect(cuesFor(quiet, { ...quiet, cleaned: 1 })).toStrictEqual(['clean'])
  })

  it('huffs when the customer loses patience', () => {
    expect(cuesFor(quiet, { ...quiet, impatient: true })).toStrictEqual(['huff'])
  })

  it('huffs once, not every frame they stay cross', () => {
    const cross = { ...quiet, impatient: true }
    expect(cuesFor(cross, cross)).toStrictEqual([])
  })

  it('stays quiet when the next customer steps up calm', () => {
    expect(cuesFor({ ...quiet, impatient: true }, quiet)).toStrictEqual([])
  })
})

describe('the speaker', () => {
  it('plays the file for a cue', () => {
    const { element, played } = fakeAudio()
    const speaker = createSpeaker(() => element)
    speaker.play('beep')
    expect(played()).toBe(1)
  })

  it('loads every cue up front so the first beep is not late', () => {
    const make = vi.fn(() => fakeAudio().element)
    createSpeaker(make)
    expect(make).toHaveBeenCalledTimes(10)
  })

  it('shrugs off a browser that refuses to play', () => {
    const element = {
      preload: '',
      volume: 0,
      play: (): Promise<void> => Promise.reject(new Error('autoplay blocked')),
      cloneNode: (): HTMLAudioElement => element,
    } as unknown as HTMLAudioElement
    const speaker = createSpeaker(() => element)
    // Autoplay policy is not the player's problem: this must not throw.
    expect(() => {
      speaker.play('coin')
    }).not.toThrow()
  })

  it('survives an audio stack that returns nothing from play', () => {
    // jsdom's `play()` returns undefined rather than a promise.
    const element = {
      preload: '',
      volume: 0,
      play: (): undefined => undefined,
      cloneNode: (): HTMLAudioElement => element,
    } as unknown as HTMLAudioElement
    const speaker = createSpeaker(() => element)
    expect(() => {
      speaker.play('drawer')
    }).not.toThrow()
  })

  it('is silent when asked to be', () => {
    expect(() => {
      SILENT.play('beep')
    }).not.toThrow()
  })
})
