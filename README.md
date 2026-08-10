# 6/7

A Japanese convenience-store clerk simulator, on the premise that konbini work
is genuinely hard.

Every store sim on the market makes the register do the thinking. Supermarket
Simulator *shows* you the change due with a counter that turns green;
inKONBINI silently auto-corrects wrong change with no penalty. **6/7 deletes
the assist.**

The customer hands you ¥1,240 for a ¥890 basket and you count the change out
of the till tray yourself, in coins, while the next guy asks for shelf 47 by
number. The loop is **read → recall → compute → act, under a clock that does
not wait.**

## The two mechanics nobody else has

**Real change arithmetic.** No game shows you what you owe. You work it out and
click the denominations. Graded on three axes: correctness (a binary gate —
wrong change is booked against the drawer), efficiency (coin count against the
fewest-coins answer, so five ¥100s instead of one ¥500 is correct but sloppy),
and speed against a per-basket par.

**Cigarettes by shelf number.** In a real konbini the customer says "Mevius,
number 47" — or just "47" — and the clerk turns and grabs it without looking.
The wall escalates: shifts 1–2 show brand names, shifts 3–5 fade them and offer
a lookup chart that costs you two seconds and some score, shift 6+ gives you
bare numbers and brand-name-only requests. The taxed chart is the point —
memorisation is player-chosen, and lookups-per-shift is a stat you watch fall.

## Run it

```bash
./install.sh     # node + npm via pacman, then npm ci
./run.sh         # build and open the game
./run.sh dev     # dev server with hot reload
./run.sh check   # typecheck + lint + 100% coverage
```

## How it is built

React 19 + TypeScript 6 + Vite 8, no rendering library — this is a UI game, so
it is DOM and CSS, and item icons are emoji.

`src/core/` is pure: no DOM, no globals, dependency-injected. Nothing reads a
clock or a random number generator directly — the tick delta arrives as an
argument and the generator lives in state — so a seeded shift replays
byte-identically. That is enforced by lint: `Math.random`, `Date.now` and
`performance.now` are banned outside `src/core/clock.ts`.

Escalation lives in `Record<UnionId, Spec>` data tables with a matching `ORDER`
tuple, so one loop covers every entry. Branching code costs a test per branch;
a data table costs one loop.

**100% coverage on statements, branches, functions and lines**, with nothing
excluded, plus `eslint --max-warnings 0` over typescript-eslint
strict-type-checked, @eslint-react, unicorn and sonarjs.

## Status

M0 is built and its automated gate is green — the counter and the cigarette
shelf, `npm run check` clean at 100% coverage. It is not signed off yet: M0's
done-condition also requires actually playing three shifts and judging whether
the pressure is fun or feels like homework, and that cannot be automated.

Still to come — queue and
patience (M1), age verification and the escalating rule stack (M2), cooking
(M3), payment methods (M4), a finite till that breaks greedy change and needs
bounded-coin DP (M5), and regulars, restocking and shoplifters (M6).

Currency is JPY on purpose: yen has no sub-unit, so every amount is a plain
integer and the whole float-rounding bug class is designed out of the scoring
path.
