import { describe, expect, it } from 'vitest'
import { escapeHtml, relativeRoot, renderBody, renderDocument, renderHead, renderMarkdown } from './markup'
import { ROUTES, type Route } from './routes'

const BASE = 'https://kuhyx.github.io/konbini-67/'

const routeAt = (path: string): Route => {
  const found = ROUTES.find((route) => route.path === path)
  if (found === undefined) {
    throw new Error(`no route ${path}`)
  }
  return found
}

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    )
  })
})

describe('relativeRoot', () => {
  it('is empty at the site root and climbs one level per path segment', () => {
    expect(relativeRoot('')).toBe('')
    expect(relativeRoot('how-to-play/')).toBe('../')
    expect(relativeRoot('a/b/')).toBe('../../')
  })
})

describe('renderBody', () => {
  it('links every other page with a real relative <a href>, so it works under any base path', () => {
    const body = renderBody(routeAt(''), '')
    expect(body).toContain('<a href="how-to-play/">')
    expect(body).toContain('<a href="about/">')
    expect(body).toContain('<a href="llms.txt">')
    expect(body).toContain('<a href=".well-known/ai-catalog.json">')
    expect(body).toContain('<h1>')
  })

  it('climbs back to the root from a nested page and marks the current page', () => {
    const body = renderBody(routeAt('how-to-play/'), '../')
    expect(body).toContain('<a href="../">')
    expect(body).toContain('<a href="../about/">')
    expect(body).toContain('aria-current="page"')
  })

  it('renders every section heading, paragraph and list item of the route', () => {
    const route = routeAt('how-to-play/')
    const body = renderBody(route, '../')
    for (const section of route.sections) {
      expect(body).toContain(escapeHtml(section.heading))
      for (const line of [...section.paragraphs, ...section.items]) {
        expect(body).toContain(escapeHtml(line))
      }
    }
  })
})

describe('renderHead', () => {
  it('carries the catalog link, the markdown alternate and JSON-LD with @context', () => {
    const head = renderHead(routeAt(''), BASE, '')
    expect(head).toContain('<link rel="ai-catalog" href=".well-known/ai-catalog.json" type="application/ai-catalog+json">')
    expect(head).toContain('<link rel="alternate" type="text/markdown" href="index.md">')
    expect(head).toContain('<link rel="canonical" href="https://kuhyx.github.io/konbini-67/">')
    expect(head).toContain('<script type="application/ld+json">')
    expect(head).toContain('"@context":"https://schema.org"')
  })

  it('points a nested page at its own mirror and the root catalog', () => {
    const head = renderHead(routeAt('about/'), BASE, '../')
    expect(head).toContain('href="../.well-known/ai-catalog.json"')
    expect(head).toContain('<link rel="canonical" href="https://kuhyx.github.io/konbini-67/about/">')
  })
})

describe('renderDocument', () => {
  it('is a complete page with the route title and its body', () => {
    const html = renderDocument(routeAt('about/'), BASE, '../')
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<title>About — 6/7</title>')
    expect(html).toContain(renderBody(routeAt('about/'), '../'))
  })
})

describe('renderMarkdown', () => {
  it('mirrors the page text with absolute links and no code fences', () => {
    const route = routeAt('how-to-play/')
    const markdown = renderMarkdown(route, BASE)
    expect(markdown.startsWith(`# ${route.title}\n`)).toBe(true)
    expect(markdown).toContain(`> ${route.description}`)
    for (const section of route.sections) {
      expect(markdown).toContain(`## ${section.heading}`)
      for (const item of section.items) {
        expect(markdown).toContain(`- ${item}`)
      }
    }
    expect(markdown).toContain('(https://kuhyx.github.io/konbini-67/about/)')
    expect(markdown).not.toContain('```')
  })
})

describe('JSON-LD escaping', () => {
  it('cannot close its own <script> tag, whatever the page text says', () => {
    const hostile: Route = { ...routeAt('about/'), description: '</script><b>x' }
    const head = renderHead(hostile, BASE, '../')
    expect(head).not.toContain('</script><b>')
    expect(head).toContain(String.fromCodePoint(0x5C) + 'u003c/script>')
  })
})
