import { SITE_NAME } from './config.ts'
import type { Route } from './routes.ts'

const AUTHOR = { '@type': 'Person', name: 'kuhy', url: 'https://github.com/kuhyx' } as const

/**
schema.org JSON-LD for a page: the game page is the VideoGame itself, every
other page is a WebPage that is part of it.
*/
export const jsonLd = (route: Route, base: string): Record<string, unknown> => {
  const url = base + route.path
  if (route.path === '') {
    return {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: SITE_NAME,
      url,
      description: route.description,
      genre: ['Simulation', 'Puzzle'],
      gamePlatform: 'Web browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      playMode: 'SinglePlayer',
      inLanguage: 'en',
      isAccessibleForFree: true,
      author: AUTHOR,
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.title,
    url,
    description: route.description,
    inLanguage: 'en',
    isPartOf: { '@type': 'VideoGame', name: SITE_NAME, url: base },
  }
}

/**
A JSON-LD block safe to inline: `<` is escaped so text can never close the tag.
*/
export const jsonLdScript = (route: Route, base: string): string => {
  // Built from the code point: a literal backslash-u escape here gets rewritten
  // to the bare character by tooling, which silently disables the escaping.
  const escaped = `${String.fromCodePoint(0x5C)}u003c`
  const json = JSON.stringify(jsonLd(route, base)).replaceAll('<', () => escaped)
  return `<script type="application/ld+json">${json}</script>`
}
