import { describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import { injectHome, siteFiles } from './artifacts'
import { SITE_URL } from './config'
import { agentReady, type EmittedFile } from './plugin'

describe('agentReady', () => {
  it('is a Vite plugin', () => {
    const plugin: Plugin = agentReady()
    expect(plugin.name).toBe('agent-ready')
  })

  it('fills the game page from the default base', () => {
    const shell = '<head></head><div id="root"></div>'
    expect(agentReady().transformIndexHtml(shell)).toBe(injectHome(shell, SITE_URL))
  })

  it('emits every generated file as an asset of the bundle', () => {
    const emitted: EmittedFile[] = []
    agentReady('https://konbini.example/').generateBundle.call({
      emitFile: (file: EmittedFile): string => {
        emitted.push(file)
        return file.fileName
      },
    })
    expect(emitted).toEqual(
      siteFiles('https://konbini.example/').map((file) => ({ type: 'asset', ...file })),
    )
  })
})
