import { describe, expect, it } from 'vitest'
import { aiCatalog, injectHome, jsonLd, llmsTxt, robotsTxt, siteFiles, sitemapXml } from './artifacts'
import { ROUTES } from './routes'

const SUB = 'https://kuhyx.github.io/konbini-67/'
const ROOT = 'https://konbini.example/'
const SHELL = '<html><head><title>t</title></head><body><div id="root"></div></body></html>'

const fileNames = (base: string): string[] => siteFiles(base).map((file) => file.fileName)
const fileText = (base: string, name: string): string =>
  siteFiles(base).find((file) => file.fileName === name)?.source ?? ''

describe('robotsTxt', () => {
  it('allows every agent, training crawlers named explicitly, and points at the sitemap', () => {
    const robots = robotsTxt(SUB)
    expect(robots).toMatch(/^User-agent: \*\nAllow: \/\n/)
    for (const bot of ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended']) {
      expect(robots).toContain(`User-agent: ${bot}\nAllow: /\n`)
    }
    expect(robots).not.toContain('Disallow')
    expect(robots.trimEnd().endsWith('Sitemap: https://kuhyx.github.io/konbini-67/sitemap.xml')).toBe(true)
  })
})

describe('sitemapXml', () => {
  it('lists every route as an absolute URL under the sub-path', () => {
    const xml = sitemapXml(ROUTES, SUB)
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    for (const route of ROUTES) {
      expect(xml).toContain(`<loc>${SUB}${route.path}</loc>`)
    }
  })

  it('follows the base when the site sits at a host root', () => {
    expect(sitemapXml(ROUTES, ROOT)).toContain('<loc>https://konbini.example/how-to-play/</loc>')
  })
})

describe('llmsTxt', () => {
  it('has the H1, the summary, an H2 and a described link list', () => {
    const llms = llmsTxt(ROUTES, SUB)
    const lines = llms.split('\n')
    expect(lines[0]).toMatch(/^# \S/)
    expect(lines).toContainEqual(expect.stringMatching(/^> \S/))
    expect(lines).toContainEqual(expect.stringMatching(/^## \S/))
    expect(llms).toContain(`- [How to play](${SUB}how-to-play/): `)
    expect(llms).toContain(`(${SUB}how-to-play/index.md)`)
  })
})

describe('aiCatalog', () => {
  it('is a valid AI Catalog that lists llms.txt and every markdown mirror', () => {
    const catalog = aiCatalog(ROUTES, SUB)
    expect(catalog.specVersion).toBe('1.0')
    expect(catalog.host.displayName.length).toBeGreaterThan(0)
    const urls = catalog.entries.map((entry) => entry.url)
    expect(urls).toContain(`${SUB}llms.txt`)
    expect(urls).toContain(`${SUB}about/index.md`)
    for (const entry of catalog.entries) {
      expect(entry.identifier).toMatch(/^urn:air:kuhyx\.github\.io:konbini-67:[a-z0-9-]+$/)
      expect(entry.type).toMatch(/^[a-z]+\/[a-z.+-]+$/)
    }
    expect(new Set(catalog.entries.map((entry) => entry.identifier)).size).toBe(catalog.entries.length)
  })

  it('names the namespace after the host when there is no sub-path', () => {
    expect(aiCatalog(ROUTES, ROOT).entries[0]?.identifier).toBe('urn:air:konbini.example:site:llms')
  })
})

describe('jsonLd', () => {
  it('describes the game page as a VideoGame and the others as pages of it', () => {
    const [home, howTo] = ROUTES
    expect(home && jsonLd(home, SUB)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      url: SUB,
      gamePlatform: 'Web browser',
    })
    expect(howTo && jsonLd(howTo, SUB)).toMatchObject({
      '@type': 'WebPage',
      url: `${SUB}how-to-play/`,
      isPartOf: { '@type': 'VideoGame', url: SUB },
    })
  })
})

describe('siteFiles', () => {
  it('emits every discovery file, the 404, every mirror and every non-game page', () => {
    expect(fileNames(SUB)).toEqual([
      'robots.txt',
      'sitemap.xml',
      'llms.txt',
      '.well-known/ai-catalog.json',
      '404.html',
      'index.md',
      'how-to-play/index.html',
      'how-to-play/index.md',
      'about/index.html',
      'about/index.md',
    ])
  })

  it('gives the 404 real text and links rooted at the base path, since it is served at any depth', () => {
    const notFound = fileText(SUB, '404.html')
    expect(notFound).toContain('<a href="/konbini-67/how-to-play/">')
    expect(notFound).toContain('Page not found')
    expect(notFound).not.toContain('rel="alternate" type="text/markdown"')
  })

  it('serialises the catalog it built', () => {
    expect(JSON.parse(fileText(ROOT, '.well-known/ai-catalog.json'))).toEqual(aiCatalog(ROUTES, ROOT))
  })
})

describe('injectHome', () => {
  it('puts the no-JS game description inside #root and the agent tags in the head', () => {
    const html = injectHome(SHELL, SUB)
    expect(html).toMatch(/<div id="root"><header>[\s\S]+<\/footer><\/div>/)
    expect(html).toMatch(/<link rel="ai-catalog"[^>]*>[\s\S]*<\/head>/)
    expect(html).toContain('"@type":"VideoGame"')
    expect(html).toContain('<title>t</title>')
  })

  it('fails the build loudly when the shell no longer has the markers it fills', () => {
    expect(() => injectHome('<html><head></head><body></body></html>', SUB)).toThrow(/#root/)
    expect(() => injectHome('<div id="root"></div>', SUB)).toThrow(/<\/head>/)
  })
})
