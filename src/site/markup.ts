import { ROUTES, type Route, type Section } from './routes.ts'
import { jsonLdScript } from './structured-data.ts'

export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

/**
Relative prefix from a route back to the site root ('' at the root). Pages
link each other relatively, so the same HTML works under any base path.
*/
export const relativeRoot = (path: string): string =>
  '../'.repeat(path.split('/').filter(Boolean).length)

const navLink = (target: Route, current: Route, root: string): string => {
  const href = `${root}${target.path}` || './'
  const marker = target.path === current.path ? ' aria-current="page"' : ''
  return `<a href="${href}"${marker}>${escapeHtml(target.navLabel)}</a>`
}

const renderSection = (section: Section): string => {
  const paragraphs = section.paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`)
  const items = section.items.map((line) => `<li>${escapeHtml(line)}</li>`)
  const list = items.length > 0 ? `<ul>${items.join('')}</ul>` : ''
  return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs.join('')}${list}</section>`
}

/**
The visible page: header nav, the route's text, and a footer pointing agents
at the discovery files. `root` is the prefix that reaches the site root.
*/
export const renderBody = (route: Route, root: string): string => {
  const nav = ROUTES.map((target) => navLink(target, route, root)).join(' · ')
  const footer = `<footer><p>For agents: <a href="${root}llms.txt">llms.txt</a> · <a href="${root}.well-known/ai-catalog.json">AI catalog</a></p></footer>`
  return [
    `<header><p><strong>6/7</strong> — konbini clerk simulator</p><nav>${nav}</nav></header>`,
    `<main><h1>${escapeHtml(route.title)}</h1><p>${escapeHtml(route.description)}</p>`,
    route.sections.map((section) => renderSection(section)).join(''),
    '</main>',
    footer,
  ].join('')
}

export const catalogLink = (root: string): string =>
  `<link rel="ai-catalog" href="${root}.well-known/ai-catalog.json" type="application/ai-catalog+json">`

/**
Head tags every page carries: description, canonical URL, catalog link,
markdown mirror and JSON-LD.
*/
export const renderHead = (route: Route, base: string, root: string): string =>
  [
    `<meta name="description" content="${escapeHtml(route.description)}">`,
    `<link rel="canonical" href="${base}${route.path}">`,
    catalogLink(root),
    '<link rel="alternate" type="text/markdown" href="index.md">',
    jsonLdScript(route, base),
  ].join('\n')

const STYLE =
  'body{margin:0 auto;max-width:42rem;padding:1.5rem;background:#211d1b;color:#efe9e1;font:1rem/1.6 system-ui,sans-serif}a{color:#d9a54a}h1,h2{line-height:1.25}nav a[aria-current]{font-weight:700}'

/**
A complete standalone page (every route except the game, which Vite builds).
*/
export const renderDocument = (
  route: Route,
  base: string,
  root: string,
  head: string = renderHead(route, base, root),
): string =>
  [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtml(route.title)} — 6/7</title>`,
    head,
    `<style>${STYLE}</style>`,
    '</head>',
    `<body>${renderBody(route, root)}</body>`,
    '</html>',
    '',
  ].join('\n')

/**
The markdown mirror of a page: the same text, absolute links, no code fences.
*/
export const renderMarkdown = (route: Route, base: string): string => {
  const sections = route.sections.map((section) =>
    [
      `## ${section.heading}`,
      ...section.paragraphs,
      section.items.map((item) => `- ${item}`).join('\n'),
    ]
      .filter(Boolean)
      .join('\n\n'),
  )
  const pages = ROUTES.filter((other) => other.path !== route.path).map(
    (other) => `- [${other.navLabel}](${base}${other.path}): ${other.description}`,
  )
  const parts = [`# ${route.title}`, `> ${route.description}`, ...sections, `## Pages\n\n${pages.join('\n')}`]
  return `${parts.join('\n\n')}\n`
}
