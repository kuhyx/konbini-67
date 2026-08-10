/**
 * The shop's noises.
 *
 * Sound is a side effect, so none of it lives in the reducer: the shift stays
 * a pure function of its events, and this layer reacts to what came out. That
 * keeps seeded replay honest and means a test never has to silence anything.
 *
 * Playback is best-effort by design. Browsers refuse audio before the first
 * user gesture, a file may 404, and neither is worth interrupting a shift
 * over — a konbini with a broken speaker still sells onigiri.
 */

export type Cue = 'beep' | 'reject' | 'coin' | 'drawer'

const FILES: Record<Cue, string> = {
  beep: 'sfx/beep.ogg',
  reject: 'sfx/reject.ogg',
  coin: 'sfx/coin.ogg',
  drawer: 'sfx/drawer.ogg',
}

/**
 * How loud each cue is, relative to the others.
 *
 * The scanner beep fires most often, so it sits lowest — a real one is a
 * background tick, not an event.
 */
const GAIN: Record<Cue, number> = {
  beep: 0.25,
  reject: 0.3,
  coin: 0.35,
  drawer: 0.3,
}

export interface Speaker {
  play: (cue: Cue) => void
}

/**
 * The parts of the shift that make a noise when they change.
 */
export interface Audible {
  readonly scanned: number
  readonly message: string
  readonly trayPieces: number
}

/**
 * Which cues fire on the step from one state to the next.
 *
 * Pure, and deliberately outside React: "what changed since last time" is
 * arithmetic over two values, not something that needs a ref. The component
 * hands over the before and after and plays whatever comes back.
 */
export const cuesFor = (before: Audible, after: Audible): readonly Cue[] => {
  const cues: Cue[] = []
  if (after.scanned > before.scanned) {
    cues.push('beep')
  }
  if (after.trayPieces > before.trayPieces) {
    cues.push('coin')
  }
  if (after.message !== before.message) {
    if (after.message.includes('No beep')) {
      cues.push('reject')
    }
    if (after.message.includes('put their money down') || after.message.includes('pay it')) {
      cues.push('drawer')
    }
  }
  return cues
}

/**
 * A speaker that does nothing. Used by tests and by anything running without
 * a DOM, so callers never have to check whether sound exists.
 */
export const SILENT: Speaker = {
  play: () => {
    // Deliberately nothing.
  },
}

/**
 * Builds a speaker over a set of preloaded audio elements.
 *
 * `make` is injected so a test can supply its own element factory and assert
 * what was played without a real audio stack. Each cue is cloned on play, so
 * two beeps in quick succession overlap rather than cutting each other off —
 * which is exactly what happens when you sweep two items fast.
 */
export const createSpeaker = (
  make: (source: string) => HTMLAudioElement = (source) => new Audio(source),
): Speaker => {
  // A record rather than a Map: every cue is loaded here, so a lookup can
  // never miss and there is no absent case to handle.
  const loaded = {} as Record<Cue, HTMLAudioElement>
  for (const cue of Object.keys(FILES) as Cue[]) {
    const element = make(FILES[cue])
    element.preload = 'auto'
    element.volume = GAIN[cue]
    loaded[cue] = element
  }
  return {
    play: (cue: Cue): void => {
      const voice = loaded[cue].cloneNode(true) as HTMLAudioElement
      voice.volume = GAIN[cue]
      // `play()` returns a promise in a browser and nothing at all under
      // jsdom, so the result is checked rather than assumed. A rejection means
      // autoplay policy or a missing file; neither should reach the player.
      const started: unknown = voice.play()
      if (started instanceof Promise) {
        void started.catch(() => {
          // Autoplay policy or a missing file; not the player's problem.
        })
      }
    },
  }
}
