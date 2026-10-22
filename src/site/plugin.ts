import { injectHome, siteFiles } from './artifacts.ts'
import { SITE_URL } from './config.ts'

export interface EmittedFile {
  readonly type: 'asset'
  readonly fileName: string
  readonly source: string
}

interface Emitter {
  emitFile: (file: EmittedFile) => string
}

export interface AgentReadyPlugin {
  readonly name: string
  readonly transformIndexHtml: (html: string) => string
  readonly generateBundle: (this: Emitter) => void
}

/**
Vite plugin that makes the build agent-ready: it prerenders the game page's
no-JS content and emits every generated page, mirror and discovery file.
A thin adapter: all the content logic lives in artifacts.ts.
*/
export const agentReady = (base: string = SITE_URL): AgentReadyPlugin => ({
  name: 'agent-ready',
  transformIndexHtml: (html: string): string => injectHome(html, base),
  generateBundle(this: Emitter): void {
    for (const file of siteFiles(base)) {
      this.emitFile({ type: 'asset', ...file })
    }
  },
})
