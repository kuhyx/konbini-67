import { SITE_SUMMARY } from './config.ts'

/**
The single source of truth for the site's pages. Every HTML page, markdown
mirror, sitemap entry, llms.txt line and catalog entry is generated from this
table, so a new route needs no other edit.

Text is plain (no markup) so the same string renders as HTML and markdown.
*/
export interface Section {
  readonly heading: string
  readonly paragraphs: readonly string[]
  readonly items: readonly string[]
}

export interface Route {
  /**
  Relative to the base URL: '' for the game, otherwise 'name/'.
  */
  readonly path: string
  readonly title: string
  readonly navLabel: string
  readonly description: string
  readonly sections: readonly Section[]
}

const HOME: Route = {
  path: '',
  title: '6/7 — a konbini clerk simulator',
  navLabel: 'Play',
  description: SITE_SUMMARY,
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Every store simulator makes the register do the thinking: it shows the change due, or quietly corrects a wrong answer. 6/7 deletes the assist. A customer hands you ¥1,240 for a ¥890 basket and you count the change out of the till yourself, coin by coin, while the next customer asks for cigarettes by shelf number.',
        'The loop is read, recall, compute, act, under a clock that does not wait. There is no scoreboard on screen: a real shop does not have one either.',
      ],
      items: [],
    },
    {
      heading: 'Two mechanics nobody else has',
      paragraphs: [],
      items: [
        'Real change arithmetic: no screen tells you what you owe. Wrong change is booked against the drawer, and five ¥100 coins instead of one ¥500 is correct but sloppy.',
        'Cigarettes by shelf number: customers say "Mevius, number 47" or just "47". Later shifts fade the brand names and finally give bare numbers, with a lookup chart that costs time and score.',
      ],
    },
    {
      heading: 'Play it',
      paragraphs: [
        'The game runs in any modern browser with JavaScript enabled: no install, no account and no download. It is built with React and TypeScript, and the item art is emoji on purpose while the mechanics are proven.',
        'It is also published on itch.io at https://kuhyx.itch.io/konbini-67 for anyone who prefers to play there.',
      ],
      items: [],
    },
  ],
}

const HOW_TO_PLAY: Route = {
  path: 'how-to-play/',
  title: 'How to play',
  navLabel: 'How to play',
  description:
    'How a shift in 6/7 works, every control, and what counts as a good shift behind the till.',
  sections: [
    {
      heading: 'A customer, start to finish',
      paragraphs: [],
      items: [
        'Ring up: the shopping lands on the counter. Drag each item across the scanner beam until it beeps.',
        'Announce the price: type the total into the price box and say it. The till does not check your sum, and a customer may or may not query a wrong one.',
        'Read the money: the customer pays with notes and coins scattered on the counter. Count them by eye.',
        'Give change: click coins and notes in the till to count the change out, then press "That\'s everything" to hand it over.',
        'Check ID: beer and tobacco need an age check. Asking, accepting or refusing the sale is your call.',
      ],
    },
    {
      heading: 'Controls',
      paragraphs: ['The game is played with the mouse (or touch) plus the keyboard for the price.'],
      items: [
        'Drag an item over the scanner beam to scan it.',
        'Type digits in the price box and press Enter to say the price.',
        'Click a denomination in the till to give one of it; click the minus under it to take one back.',
        'Click "Turn to the shelf" and then a slot number to fetch cigarettes; "Check the chart" looks a number up at a cost.',
        'Click "Look at the clock" to read the analog wall clock, "Go out back" to restock, and "To the hot case" for hot food.',
        'Click "Ask for ID", "Refuse the sale" or "Apologise" when the moment calls for it.',
      ],
    },
    {
      heading: 'Everything else in the shop',
      paragraphs: [],
      items: [
        'The till holds a finite amount of money. When it cannot make the change you ask for something smaller, suggest a card, owe the difference or fetch the manager.',
        'Hot food cooks on its own timer while you serve: hotdogs, pizza, coffee and soft serve go from raw to ready to ruined.',
        'Shelves run empty, so stock them from the back between customers, and clean up spills before they sour the mood.',
        'Customers mind being kept waiting. An apology buys a little patience; a customer who leaves takes the sale with them.',
      ],
    },
    {
      heading: 'What a good shift looks like',
      paragraphs: [
        'A shift lasts three minutes of real time. It is judged on correct change, on using the fewest coins, and on speed against a par for each basket. The number of chart lookups per shift is the stat to watch fall as you memorise the wall.',
      ],
      items: [],
    },
  ],
}

const ABOUT: Route = {
  path: 'about/',
  title: 'About',
  navLabel: 'About',
  description:
    'Why 6/7 exists, how it is built, and what is still to come.',
  sections: [
    {
      heading: 'Why',
      paragraphs: [
        'Konbini work is genuinely hard, and store games hide that by doing the clerk\'s thinking. 6/7 keeps the hard part, unaided arithmetic under time pressure, and makes it the game. Currency is yen on purpose: it has no sub-unit, so every amount is a whole number.',
      ],
      items: [],
    },
    {
      heading: 'How it is built',
      paragraphs: [
        'React and TypeScript on Vite, with no rendering library: it is a DOM and CSS game. The game logic is pure and seeded, so a shift replays identically, and it is held to 100% test coverage with strict linting.',
      ],
      items: [],
    },
    {
      heading: 'Status',
      paragraphs: [],
      items: [
        'Built: change arithmetic, the cigarette wall, the analog clock, finite cash, ID checks, stocking and cleaning, impatient customers and the hot case.',
        'Still to come: payment methods, regulars and shoplifters.',
        'Sound effects are CC0 recordings, credited in the repository. Made by kuhy.',
      ],
    },
  ],
}

export const ROUTES: readonly Route[] = [HOME, HOW_TO_PLAY, ABOUT]
