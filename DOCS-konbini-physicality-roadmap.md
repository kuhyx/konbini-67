# Physicality pass: roadmap

## The roadmap: what the game was still missing (item 9) — NOW BUILT

> **Status: all four built, 2026-08-10.** Stocking and cleaning (M6), angry
> customers (M1) and hot food (M3) each landed as their own commit with the
> gate green between them. 481 tests, 100% coverage on all four metrics, zero
> exclusions, zero lint suppressions. What follows is the design as specified;
> the notes below each section record what actually shipped.
>
> Emoji placeholders throughout, by explicit choice — the art pass is a
> separate job now that the mechanics have proven themselves.

Requested verbatim: *"we are missing a lot of features — stocking items on
shelves, handling angry customers, doing food stuff like hotdogs, pizzas, ice
cream, coffee and so on, cleaning."* No code was written for any of this; this
section exists so the next session builds it in a sane order instead of
inventing one.

**These are not new milestones.** Three of the four already have homes in the
plan, and the numbering below keeps them there rather than minting M7+ for work
that is already scheduled:

| Feature | Milestone | Status in plan |
|---|---|---|
| Hot food (hotdogs, pizza, ice cream, coffee) | **M3** | already "cooking" — now specified |
| Angry customers | **M1** | queue + patience; anger is patience running out |
| Stocking shelves | **M6** | already "restocking" — now specified |
| Cleaning | **M6** | new, but same shape as restocking: downtime work |

### M1 — angry customers (patience is already the mechanic)

Anger is not a new system, it is what patience expiring *looks like*. The queue
already implies a per-customer timer; the design work is making anger legible
and physical rather than a number going red.

- Anger escalates in **visible stages** — posture, then a spoken line, then
  leaving. Never a patience bar: a real clerk reads a face, not a HUD.
- What causes it is already in the game and should stay diegetic: waiting,
  being misquoted (round three item 1), being shorted change, a failed ID check.
- The physical response the cashier actually has is **apologising and being
  fast**, not a "calm customer" button. An apology costs a beat of time — that
  is the trade, and it is the same currency as everything else.
- A customer who leaves takes the sale with them. That is the whole penalty; no
  score deduction on top, per the no-scoreboard rule.

### M3 — hot food (the first mechanic with its own clock)

This is the largest of the four and the one that changes the loop, because it
introduces work that **continues while you serve someone else**. Everything so
far is strictly one customer at a time.

- A hotdog on the roller, a pizza in the oven and coffee pouring all have a
  **cook timer that runs in real time** and a state past "done" that is burnt or
  stale. That is the source of the pressure: the timer does not pause for the
  queue.
- The physical actions are put-in, take-out, hand-over — three drags, matching
  the round-three rule, because moving hot food *is* the job.
- **Ice cream and coffee are the cheap ones** (pour, hand over: no roller state
  machine) and should ship first as the vertical slice that proves the
  concurrent-timer plumbing before hotdogs and pizza pile on top.
- The reducer stays pure: cook state advances from the same tick the clock
  already uses, so a seeded replay still reproduces a burnt hotdog exactly.

### M6 — stocking and cleaning (what fills the gaps)

Both are **downtime work**, and that is the point: they give the empty moments
between customers a cost, so standing idle stops being free.

- Stocking: a shelf that runs out means a customer cannot buy that item. The
  restock is physical — a crate arrives, items get dragged onto the shelf.
- Cleaning: spills and litter appear over a shift and are dragged to a bin.
  A dirty shop should feed customer mood (M1), which is the cheapest possible
  coupling between the two and avoids inventing a cleanliness score.
- Both must be **interruptible**. A customer arriving mid-restock is the
  interesting case; a modal that locks you out of the till would be the wrong
  build, and is the specific failure to avoid here.

### What shipped, against what was specified

The order held: M6 first (cheapest, independent), then M1, then M3. Three
things came out differently from the plan, all recorded because the reasoning
is reusable:

- **Anger needed no queue.** `customerStartMs` was already in the state for
  the speed bonus, so impatience reads from it. The spec assumed a queue had
  to exist first; it did not.
- **Cleaning became a click, not a drag.** Round three's rule applied cleanly:
  wiping a counter is one motion with no decision in it. Dragging a cloth
  would have been friction cosplaying as depth.
- **Mess feeds mood rather than its own score.** That coupling is what gives
  cleaning teeth — a customer surrounded by litter is less patient — and it
  avoided inventing a cleanliness stat nobody asked for.

One real bug came out of the interaction between M6 and M1: a test helper that
ticked until N messes existed could spin for ever, because past the patience
limit the customer walks out and `advance` starts a fresh one. Bounded rather
than given a longer timeout.

### Order, and the one hard dependency

**M1 before M3.** Concurrent cook timers are only interesting if someone is
waiting, and anger is what makes waiting cost something — building M3 first
means building a pressure system with nothing to apply pressure to. M6 is
independent of both and can land whenever; it is the cheapest of the three.

M0 was signed off before any of this was built, on a play-check rather than a
gate — which is what made it safe to start.
