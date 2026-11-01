# Physicality pass: requests and principles

## The requests, as given

1. Scanning is physical — move the item under the laser; a miss is a miss, not
   a "scan item" button.
2. Reading the cigarette shelf is physical — the clerk turns their head away
   from the customer; plus a notebook to write down that slot 5 is Hi-Lite.
3. Cash is finite — work with what the drawer holds; customer payments go into
   the drawer and become spendable.
4. Taking money out is physical — no "how much you hold / how much you owe"
   readouts. Money is scattered; the player reads and counts it themselves.
5. *(no item 5 — the numbering slipped; confirmed nothing was lost)*
6. `"Wrong change. They noticed."` names the actual mistake:
   a) shorted the customer → they get angry;
   b) shorted the shop → told by how much, and you fix it in the books.
7. ID checks on beer and cigarettes; the customer may fail, and may argue.
8. No convenient countdown. A **digital wall clock** you physically look at;
   you work out the time remaining yourself, and you cannot serve while
   looking.

---

## Two of these are already approved milestones, out of order

| Request | Plan status |
|---|---|
| **3. finite cash** | **M5** — "the only genuinely hard algorithm in the project", gated on its own for that reason |
| **7. ID checks** | **M2** — age verification + the Papers-Please rule stack |
| 1, 2, 4, 6, 8 | not in the plan at all — a new *physicality* axis |

**Resolved: build all eight now.** M5's bounded-coin DP and M2's rule stack
both land ahead of M1 (queue + patience), which slips behind them. Recorded
here because it reorders an approved plan.

The plan is explicit that finite cash is not a tuning change:

> greedy *is* optimal for the canonical JPY set, so M0–M4 assume an unlimited
> till and use `greedyChange` as the reference. The moment denomination counts
> go finite, greedy breaks and the reference must become bounded-coin DP — a
> different algorithm with a much larger test surface.

So `optimalCount` (the efficiency score's reference) silently becomes wrong the
day the drawer goes finite. It is not a display change.

**Resolved as built.** `boundedChange(amount, drawer)` in `money.ts` is that DP,
and `score.ts` scores surplus coins against it rather than against
`optimalCount`, which now survives only as the unbounded reference. A drawer
that cannot make the change at all returns `undefined`, and whatever the player
managed is treated as optimal — the alternative would be punishing them for the
till's state rather than their arithmetic.

## M0 is signed off (2026-08-10)

Confirmed at the time: you played it, and these eight are what it needed. So
this was never a new milestone bolted onto a finished M0 — **it was M0's
completion condition.** The core loop worked; it read as too abstract. Every
item on the list removed an abstraction and put a physical action in its place.

That set the done-condition for this spec: M0 is signed off when you play three
shifts *with these in* and the arithmetic-under-pressure is fun rather than
homework. No automated gate could settle it — and after four rounds you played
it and said it plays ok. **Signed off.** What follows is the roadmap, which is
now the live work rather than a someday-list.

---

## The governing design principle (kuhy, 2026-08-10)

> **ALL design choices and questions should be answered by imagining you are a
> REAL PHYSICAL CASHIER IN A REAL LIFE/WORLD SCENARIO** — and asking what
> options you would actually have.

This overrides my instinct to reach for abstract game mechanics. Concretely, it
already changed three of my drafts:

- I proposed "hand the nearest amount and eat a penalty" for the empty drawer.
  No real clerk does that. A real clerk **negotiates**: *"Nie ma pan drobniej?
  Nie ma pan grosika?"*, offers card, offers to owe the odd coin, or asks the
  manager for a float. Penalties are a game designer's answer; conversation is
  the real one.
- "A miss is just a miss" (1c) is right for the same reason: drop an item at a
  real till and you simply pick it up again. The clock is the punishment.
- Score penalties generally are suspect. A real shift punishes you with **time,
  an annoyed customer, and a drawer that does not balance** — not points.

**Applies to every unresolved fork below, and to anything I hit while building
that this spec did not anticipate.** When in doubt: what would the clerk do?

## The constraint every design below has to respect

Three invariants are load-bearing today, and physicality threatens all three:

1. **100% coverage, four metrics, zero exclusions** (non-negotiable, backlog).
2. **Byte-identical seeded replay**, lint-enforced: no `Math.random`,
   `Date.now`, `performance.now` outside `clock.ts`.
3. **`useGameLoop` is the only frame-loop owner** — which is *why* timing is
   reachable from tests.

Drag physics, laser hit-testing and scattered-money layout each want their own
timer, their own clock read, and untestable DOM geometry.

**Design rule (hard constraint, not a draft):** every physical action
decomposes into a pure event on the existing closed `ShiftEvent` union. All
positions and scatter offsets come from the injected `Rng`; all motion
integrates the delta `useGameLoop` already provides. The DOM layer stays a pure
props→JSX renderer, and hit-testing is **arithmetic over state coordinates —
never `getBoundingClientRect`**. That is not a style preference: jsdom has no
layout engine and returns zeros, so any hit-test that reads real layout is
untestable and takes the coverage bar down with it. Positions live in state and
the DOM renders them via transforms. If drag gets its own
`requestAnimationFrame`, coverage and replay both die. (This session already
showed how a second timer path hides a real bug.)

### One gaze union, not three booleans

Items 2, 8 and the notebook are the same mechanic: looking somewhere means not
looking at the customer. Three independent booleans (`lookupOpen`,
`clockOpen`, `notebookOpen`) would multiply against the existing `phase` union
and make 100% branch coverage brutal. So:

```ts
readonly gaze: 'counter' | 'shelf' | 'clock' | 'notebook'
```

> As built, minus the notebook that round three deleted:
> `export type Gaze = 'counter' | 'shelf' | 'clock'` (`types.ts:129`), with the
> `Record<Gaze, GazeSpec>` and `GAZE_ORDER` exactly as designed here.

with a `Record<Gaze, GazeSpec>` holding what each hides and what it costs —
the plan's own "the ladder becomes data" rule. This **replaces** `lookupOpen`
rather than sitting beside it, and the existing `state.phase !== 'shelf'` guard
in `onPickSlot` becomes gaze-aware.

