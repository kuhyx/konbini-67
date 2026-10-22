import { SITE_NAME, SITE_SUMMARY } from './config.ts'
import { catalogLink, escapeHtml, relativeRoot, renderBody, renderDocument, renderHead, renderMarkdown } from './markup.ts'
import { ROUTES, type Route } from './routes.ts'

export { jsonLd } from './structured-data.ts'

export interface SiteFile {
  readonly fileName: string
  readonly source: string
}

export interface CatalogEntry {
  readonly identifier: string
  readonly displayName: string
  readonly type: string
  readonly url: string
}

export interface AiCatalog {
  readonly specVersion: string
  readonly host: { readonly displayName: string; readonly identifier: string; readonly documentationUrl: string }
  readonly entries: readonly CatalogEntry[]
}

/**
Crawlers named explicitly as well as covered by `*`: kuhy allows training
crawlers too, and an explicit group survives a later `*` tightening.
*/
const NAMED_AGENTS = ['GPTBot', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'CCBot', 'Google-Extended', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot']

export const robotsTxt = (base: string): string =>
  [...['*', ...NAMED_AGENTS].map((agent) => `User-agent: ${agent}\nAllow: /\n`), `Sitemap: ${base}sitemap.xml`, ''].join('\n')

export const sitemapXml = (routes: readonly Route[], base: string): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map((route) => `  <url><loc>${escapeHtml(base + route.path)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n')

export const llmsTxt = (routes: readonly Route[], base: string): string => {
  const pages = routes.map((route) => `- [${route.navLabel}](${base}${route.path}): ${route.description}`)
  const mirrors = routes.map((route) => `- [${route.navLabel} (markdown)](${base}${route.path}index.md): plain-text mirror of the page`)
  return [
    `# ${SITE_NAME}`,
    `> ${SITE_SUMMARY}`,
    `## Pages\n\n${pages.join('\n')}`,
    `## Markdown mirrors\n\n${mirrors.join('\n')}`,
    '',
  ].join('\n\n')
}

/**
`urn:air:<host>:<namespace>:` where the namespace is the sub-path, or 'site'.
*/
const urnPrefix = (base: string): string => {
  const url = new URL(base)
  const namespace = url.pathname.split('/').filter(Boolean).join('-') || 'site'
  return `urn:air:${url.host}:${namespace}:`
}

const slug = (route: Route): string => route.path.split('/').filter(Boolean).join('-') || 'home'

export const aiCatalog = (routes: readonly Route[], base: string): AiCatalog => {
  const urn = urnPrefix(base)
  const mirrors = routes.map((route) => ({
    identifier: `${urn}markdown-${slug(route)}`,
    displayName: `${route.navLabel} (markdown)`,
    type: 'text/markdown',
    url: `${base}${route.path}index.md`,
  }))
  return {
    specVersion: '1.0',
    host: { displayName: SITE_NAME, identifier: base, documentationUrl: `${base}how-to-play/` },
    entries: [
      { identifier: `${urn}llms`, displayName: 'llms.txt', type: 'text/plain', url: `${base}llms.txt` },
      { identifier: `${urn}sitemap`, displayName: 'Sitemap', type: 'application/xml', url: `${base}sitemap.xml` },
      ...mirrors,
    ],
  }
}

const NOT_FOUND: Route = {
  path: '404',
  title: 'Page not found',
  navLabel: 'Not found',
  description: 'There is no page at this address. The game and its guides are linked here instead.',
  sections: [
    {
      heading: 'Where to go instead',
      paragraphs: ['6/7 is a konbini clerk simulator played in the browser. These are its pages:'],
      items: ROUTES.map((route) => `${route.navLabel}: ${route.description}`),
    },
  ],
}

/**
The 404 is served at whatever depth the missing URL had, so its links are
rooted at the base path instead of relative.
*/
const notFoundHtml = (base: string): string => {
  const root = new URL(base).pathname
  const head = [`<meta name="description" content="${escapeHtml(NOT_FOUND.description)}">`, catalogLink(root)].join('\n')
  return renderDocument(NOT_FOUND, base, root, head)
}

/**
Every generated file of the build, all derived from `base` and the route table.
The game page itself is not here: Vite builds it and `injectHome` fills it.
*/
export const siteFiles = (base: string, routes: readonly Route[] = ROUTES): SiteFile[] => [
  { fileName: 'robots.txt', source: robotsTxt(base) },
  { fileName: 'sitemap.xml', source: sitemapXml(routes, base) },
  { fileName: 'llms.txt', source: llmsTxt(routes, base) },
  { fileName: '.well-known/ai-catalog.json', source: `${JSON.stringify(aiCatalog(routes, base), undefined, 2)}\n` },
  { fileName: '404.html', source: notFoundHtml(base) },
  ...routes.flatMap((route) => [
    ...(route.path === '' ? [] : [{ fileName: `${route.path}index.html`, source: renderDocument(route, base, relativeRoot(route.path)) }]),
    { fileName: `${route.path}index.md`, source: renderMarkdown(route, base) },
  ]),
]

const ROOT_MARKER = '<div id="root"></div>'

/**
Fill the game page Vite builds: the head tags, and the no-JS description of
the game inside #root, which React replaces as soon as the game mounts.
*/
export const injectHome = (html: string, base: string): string => {
  const [home] = ROUTES
  if (home === undefined || !html.includes(ROOT_MARKER)) {
    throw new Error(`agent-ready: index.html has no empty ${ROOT_MARKER} (#root) to prerender into`)
  }
  if (!html.includes('</head>')) {
    throw new Error('agent-ready: index.html has no </head> to put the agent tags before')
  }
  const head = `${renderHead(home, base, '')}\n</head>`
  const body = `<div id="root">${renderBody(home, '')}</div>`
  // Callbacks, so a `$&` in the content can never be read as a replace pattern.
  return html.replace('</head>', () => head).replace(ROOT_MARKER, () => body)
}
