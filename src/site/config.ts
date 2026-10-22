/**
The one absolute base URL every agent-facing artifact derives from: robots.txt,
sitemap.xml, llms.txt, the AI Catalog, JSON-LD, canonical links and mirrors.

A host root on purpose: robots.txt, llms.txt and /.well-known/ai-catalog.json
only count at the root of a host, so a GitHub Pages sub-path could never pass
the AgentReady checker. kuhyx.itch.io/konbini-67 is not used either: itch
serves the build from a nested CDN host, so nothing emitted here lives there.
Pages link each other relatively, so changing this line is the whole move.
*/
export const SITE_URL = 'https://konbini-67.kuhy.duckdns.org/'

/**
Display name shared by the page titles, llms.txt and the catalog host.
*/
export const SITE_NAME = '6/7 — Konbini'

/**
One-sentence summary: the game page's description and the llms.txt summary.
*/
export const SITE_SUMMARY =
  '6/7 is a free browser game about working the till of a Japanese convenience store, where nothing does the arithmetic for you.'
