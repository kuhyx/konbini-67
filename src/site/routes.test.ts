import { describe, expect, it } from 'vitest'
import { SITE_URL } from './config'
import { ROUTES } from './routes'

describe('ROUTES', () => {
  it('is the game page plus a how-to-play and an about page', () => {
    expect(ROUTES.map((route) => route.path)).toEqual(['', 'how-to-play/', 'about/'])
  })

  it('gives every page a title, a description and real text', () => {
    for (const route of ROUTES) {
      expect(route.title.length).toBeGreaterThan(0)
      expect(route.navLabel.length).toBeGreaterThan(0)
      expect(route.description.length).toBeGreaterThan(20)
      const words = route.sections.flatMap((section) => [...section.paragraphs, ...section.items])
      expect(words.join(' ').length).toBeGreaterThan(300)
    }
  })

  it('documents the controls on the how-to-play page', () => {
    const howTo = ROUTES[1]
    expect(howTo?.sections.map((section) => section.heading)).toContain('Controls')
  })
})

describe('SITE_URL', () => {
  it('is one absolute https base ending in a slash, so every artifact can derive from it', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+\/(.+\/)?$/)
  })
})
