# SPEC: physicality pass — M0 completion conditions

> Status: **M0 SIGNED OFF — 2026-08-10.** kuhy played it after round four and
> said it plays ok, which is exactly the done-condition below: three shifts
> played, arithmetic-under-pressure judged fun rather than homework. The
> roadmap section is therefore live work rather than a someday-list.
>
> History of how it got here: **four rounds.** The eight
> items below were built, then play testing rejected the two that matter most
> as *clicks dressed up as physical actions* (round two), and a third round
> then **reverted one of those two corrections on play**: dragging change out
> to the customer was worse than clicking it, so giving change is clicks
> again. Scanning stays a genuine mouse drag — see "Round three" below for
> what survived and what did not. Then the roadmap itself was built (stocking,
> cleaning, anger, hot food). **481 tests, 100% coverage on all four metrics,
> zero exclusions, zero lint suppressions.**
>
> **Round two's table below is kept as written, including the rows round three
> undid.** It is a record of what was built and why, not a description of the
> current build; every superseded row is marked where it is contradicted.
>
> **What remained was never code — it was the play-check, and it has happened.**
> M0's done-condition was you playing three shifts and saying whether unaided
> arithmetic under a clock is fun or feels like homework. No automated gate
> could settle that, and none did: you played it and said it plays ok.
>
> Scope as confirmed: all eight at once — finite cash pulled M5's bounded-coin
> DP forward and ID checks pulled M2 forward, so M1 (queue + patience) slips
> behind them. Sections still marked **[DRAFT]** record proposals I built on
> under the cashier principle below; say the word if any reads wrong.

## Round two: what play testing corrected (2026-08-10)

The governing lesson, worth stating before the list, because it caused six of
the ten: **a click is a decision; a movement is a movement.** Rendering an
object at a physical position and then making it clickable is not physicality,
it is a button with a costume. If the fiction is "pass this over the scanner",
the input has to be passing it over the scanner.

The second lesson is narrower and more embarrassing: I let the **100% coverage
gate pick the interaction model.** Both `counter-top.tsx` and `layout.ts`
carried comments saying, in as many words, that a click was chosen because
jsdom has no layout engine and a pointer drag would be untestable. That was
simply wrong — `fireEvent.pointerDown/Move/Up` with a stubbed
`getBoundingClientRect` on one element drives a real drag fine, and the whole
mechanic is now covered that way (`src/test/drag.ts`). A testing constraint
must never choose a design; if it appears to, the test approach is wrong.

| # | Correction | Where |
|---|---|---|
| 1 | Scanning is a **mouse drag** over the beam, not a click | `use-drag.ts`, `counter-top.tsx` |
| 2 | No item list under the customer — the shopping is on the counter | `counter.tsx` |
| 3 | New `announcing` phase: **the customer pays only after being told the price** | `shift.ts` |
| 4 | The cigarette packet is a **physical thing** that lands on the counter and is swept like anything else | `shift.ts`, `catalog.ts` |
| 5 | The wall clock is **analog**; you read the hands | `wall-clock.tsx`, `wallclock.ts` |
| 6 | Removed the confusing `· ·` HUD placeholder | `app.tsx` |
| 7 | Turning your head no longer overwrites the message banner | `shift.ts` |
| 8 | **No live SERVED/SCORE tally** — a real shop has no scoreboard | `app.tsx` |
| 9 | Change is **dragged out of the drawer and pushed across**; only what reaches the customer counts | `till.tsx`, `shift.ts` |
| 11 | Cash-up shows the **physical drawer**, not a bulleted list | `books.tsx` |

> ⚠️ **Rows 9 and 11 were superseded by round three.** Row 9's drag was reverted
> to clicks on play; row 11's cash-up screen was deleted outright. The numbering
> skips 10 because the request list it mirrors ran 1–9 and then 11 — item 9
> carried two complaints at once (the drag, plus the "count it out yourself"
> text). Nothing was dropped.

Three consequences worth recording, because they are rules now:

- **Money is conserved through the new physical model.** Change taken out but
  left on the clerk's side is swept back into the drawer at confirm, so the
  books still balance. Handing over nothing while having counted out the
  correct change is now a *possible mistake*, and a realistic one.
- **`take-out` places pieces in a row, not a stack.** A grab takes whatever is
  topmost, so a pile on one spot would be unpickable below the top coin.
- **The `getBoundingClientRect` ban applies to game logic, not the UI seam.**
  `useDrag` measures exactly one element to convert screen pixels into the unit
  coordinates the pure core already speaks. Everything downstream is still
  arithmetic over state, and the reducer never touches the DOM.

## Round three: what the second play-check corrected (2026-08-10)

The lesson this round is the counterweight to round two's, and it matters more
because it cuts against the rule that produced the last rebuild: **physicality
is a means, not a goal.** Round two's rule — "a click is a decision; a movement
is a movement" — is right about *input the fiction is about*. Passing an item
over a scanner is the job, so it earns a drag. Counting notes out of a till is
also the job, but dragging each piece across the counter turned one decision
into nine hand movements, and it played worse. The test is not "is this
physical", it is **"is the physical act the interesting part of the job".**
When it is not, the drag is friction cosplaying as depth.

| # | Correction | Where |
|---|---|---|
| 1 | You **type the price** and can mistype it; the customer either queries a wrong price or silently pays it | `price-entry.tsx`, `shift.ts` |
| 2 | Giving change is **clicks again** (round two's row 9 reverted); the customer's tender stays physical scattered money | `till.tsx` |
| 3 | The **cash-up screen is gone** (round two's row 11 reverted) | deleted `books.tsx`, `reconcile.ts` |
| 4 | Scattered money no longer **overlaps** — pieces are spaced ≥ `MIN_GAP` | `layout.ts` |
| 5 | Customers no longer hand over **useless extra money** — coins come out only when they reduce the piece count | `customer.ts` |
| 6 | **Sound effects**, four CC0 `.ogg` files, credited | `sound.ts`, `use-sound-cues.ts`, `CREDITS.md` |
| 7 | Items have **different sizes** — an umbrella is not a stick of Pocky | `catalog.ts`, `size` on `ItemSpec` |
| 8 | The **"check your notes" notebook is removed entirely** | deleted `notebook*.ts(x)` |
| 9 | This roadmap section — no code | this file |

Three consequences that are rules now:

- **A misquote is a real, silent failure mode.** Typing the wrong total is not
  caught by the machine. Whether it is caught at all depends on a per-customer
  `willQueryThePrice` seed, so the same shift replays identically; unnoticed
  misquotes flow into `tally.misquoted` and `drawerDelta`. This is the first
  mistake in the game that costs money without ever announcing itself, which is
  exactly the shape of a real till discrepancy.
- **Deleting a readout beats adding one.** Both the cash-up screen and the
  notebook died for the same reason the live SERVED/SCORE tally died in round
  two: they did the player's remembering for them. The shop has no scoreboard.
- **`makeTender` may only add coins that pay for themselves.** A ¥5,000 note
  plus a random ¥100 is not how anyone pays. The first attempt at this rule
  used the sub-¥100 remainder, which was still wrong and shipped: ¥2,167 came
  out as a ¥5,000 note *plus ¥67 in five coins*, exactly the bug it was meant
  to fix. The correct rule is a comparison, not a formula — dig out the coins
  only when they cost fewer pieces than the shrapnel they save.

### The round-four correction, and why the test missed it

Both round-four bugs were reported from play against a green gate, and both had
a passing test asserting the thing was fixed. Worth recording because the two
failures share one shape:

- **Tender:** the test asserted `change % 100 === 0`. For ¥2,167 that holds —
  ¥5,067 − ¥2,167 = ¥2,900 — so the invariant passed while the customer handed
  over five pointless coins. The test checked an *identity the fix implied*
  rather than the *property the player cares about*. Replaced with an
  exhaustive check over every total ¥1–¥9,999: handed pieces + returned pieces
  must never exceed the bare covering note.
- **Item sizes:** the test asserted the string `'rotate(0deg) scale(1.7)'`
  appeared in the inline transform. It did, and every item still drew at one
  uniform size, because `scale()` inside `transform` composes against the
  standalone `translate` that centres the piece rather than resizing the glyph.
  Size now travels as `--thing-size` and drives `font-size`; the test reads the
  size actually applied, and both were confirmed in a real browser (25.84px vs
  21.28px, against 30.4px uniform under the old code).

**The rule:** a test that asserts a style string, or an identity the
implementation trivially satisfies, cannot fail when the screen is wrong. For
anything visual, assert the drawn result — and confirm it in a real layout
engine before calling it fixed. jsdom computes no layout, so it will agree with
whatever CSS you wrote regardless of what it does.

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

---

## Per-request design forks

### 1. Physical scanning

- **Drag, not flick — settled by the cashier principle.** A clerk *passes* an
  item over the glass; nobody throws it. Pointer-drag the item across the laser
  line, and crossing it scans. Position integrates from the game-loop delta, so
  it stays deterministic and replayable.

**1c — what does a miss cost? Resolved by the cashier principle:** nothing but
time. You pass an item over the glass, it does not beep, you pass it again.
Nobody deducts points. Two real consequences worth keeping, though, because
they *do* happen at a real till:
- **Double-scan.** Pass it twice and it rings up twice — a real error the
  customer may or may not catch, and one you have to void. Currently impossible
  (`onScan` caps at the basket count, `shift.ts:165`), and worth allowing.
- The beep is the feedback. No beep, no scan.

### 2. Head-turn to the shelf

- **CONFIRMED.** Turning to the shelf **hides the customer panel** — speech
  line and receipt both. You must remember what they asked for while reading
  the shelf, which is what makes writing "slot 5 = Hi-Lite" genuinely useful
  rather than decorative. This is also just true to life: you cannot read the
  cigarette wall and the customer's basket at the same time.

**Fork 2b — the notebook. Cashier principle argues for persistence:** a real
clerk's cheat-sheet is a scrap of paper taped to the counter, and it is
absolutely still there tomorrow. Writing it out fresh every shift is the
game-mechanic answer, not the real one.
- **[DRAFT, revised]** Notes **persist across shifts** (`localStorage`). The
  replay guarantee survives because notes are player-authored UI state that
  never feeds the reducer — they change what *you* know, not what the shift
  does. Seeded replay must therefore ignore them entirely, which is a
  constraint on where they live, not a reason to drop them.
- Cheaper alternative if you would rather not add persistence now: per-shift
  only, cleared at shift end.

### 3. Finite cash (pulls M5 forward)

Note the algorithmic consequence, since it is easy to miss: once the drawer is
finite, `optimalCount` (`score.ts:64`) is no longer a valid efficiency
reference — greedy stops being optimal — and it has to become bounded-coin DP
over what the drawer actually holds. That is the single largest piece of work
on this list.

**The plan already sets M5's done-condition, so I am not inventing a bar:**

> a property test over 500 seeded (target, till) pairs asserts the DP result is
> ≤ greedy in coin count and never exceeds available counts.

**Measured correction to the plan's premise.** The plan says greedy "breaks"
once counts go finite. For the canonical JPY set it does not. An exhaustive
enumeration over 340,995 solvable (target, till) pairs found **zero** cases
where bounded greedy needed more pieces than the DP, or failed where the DP
succeeded. The reason is that JPY is a *divisible chain* — 5|10, 10|50, 50|100,
100|500, 500|1000, 1000|5000, 5000|10000 — and for divisible systems the
exchange argument keeps greedy both optimal and complete under bounds.

The harness is not blind: a non-canonical control set (1,3,4) produced 11,520
counterexamples, and adding the real **¥2000 note** — which 1000 divides but
which does not divide 5000 — produced 720. So greedy's safety rests on a
precondition a plausible future change would silently break.

Resolution, which keeps the plan's bar met literally:
- **Bounded greedy ships** as `boundedChange`, and its piece count is the
  bounded optimum that replaces `optimalCount` inside `gradeChange`.
- **The DP lives in the test suite as an oracle**, running exactly the
  500-pair property test the plan specifies. It is the permanent guard on the
  divisibility precondition, and it is why adding ¥2000 later would fail loudly
  rather than silently mis-scoring every transaction.

Two knock-on changes this forces:
- `gradeChange(given, owed)` becomes `gradeChange(given, owed, drawer)`, and
  must return an *infeasible* case (no exact change possible) that routes into
  the negotiation options in 3a rather than grading a failure.
- `money.test.ts`'s "beats or matches any other way of making the same amount"
  asserts greedy optimality against single-denomination alternatives. That
  premise stops being true. **Rewrite it against the DP — do not delete it.**

- **3a — the empty-drawer case. CONFIRMED as negotiation, not penalty.**
  What a real clerk actually has, and what each becomes here:

  | Real option | In game |
  |---|---|
  | *"Nie ma pan drobniej?"* — ask for smaller money | Ask the customer to re-tender. They may have it (seeded); they may not. Costs time. |
  | "Could you pay by card?" | Card ends the transaction cleanly with no change at all — but cash is where the points are (per the plan's M4 tension), so it is a real trade. |
  | *"Będę winny grosika"* — owe the odd coin | Settle short by a small amount, with the customer's agreement. Books it as a known discrepancy rather than an error you have to discover. |
  | Ask the manager for a float | Refills the drawer, but costs real time and is not free to do repeatedly. |

  None of these is a scored penalty. The cost is **time, the customer's mood,
  and a drawer that has to balance at shift end.**
  - **Open [DRAFT]:** whether the customer *accepts* the odd-coin offer or the
    card suggestion is seeded per customer (some are agreeable, some are not),
    rather than always working. I think that variability is the point.
- **3b — CONFIRMED after measuring the drift.** Before building this I
  instrumented 20 seeded customers against a plausible float. The drawer is a
  **one-way ratchet**: customers pay with big notes, change only ever moves
  value downward, so ¥5000 went 1 → +21 while ¥1000 hit −55, ¥100 −60, ¥10 −35
  and ¥1 −50. ¥1000 ran out at customer **2**. No fixed float survives a shift,
  because the problem is the input, not the starting amount.

  kuhy's resolution — fix the input, and be realistic about the rest:

  - **Customers vary in how they pay.** Some exact, some near-exact, some
    hunting out coins to round the change, some one big note, some a scatter of
    small notes and coins. This is what real konbini customers do and it is
    what stops the ratchet at source.
  - **A generous opening float**, since a real till starts from a properly
    counted one.
  - **Asking the manager for change is rare** — realistically rare, as it is on
    a real shift. It is the release valve, not the rhythm.

  Note this makes the payment-style table part of item 3, not decoration: the
  drawer's survival depends on it.

### 4. Scattered money + no readouts

The deletions are cheap and I am confident about them:
- `IN HAND` total (`till.tsx:42-45`) — delete.
- `TENDERED` (`counter.tsx:50-53`) — delete; count the customer's cash yourself.

- **4a — CONFIRMED: no readout survives.** No running total, no piece count.
  You commit blind and the grade afterwards is the feedback — which is exactly
  what happens when you count notes into someone's hand. This is the
  highest-signal fun probe in the whole list.
- **Fork 4b — scatter scope [DRAFT]:** both the drawer *and* the customer's
  tender are scattered piles you visually read. Layout comes from the seeded
  `Rng`, so a replay scatters identically.

### 6. Error attribution

The data already exists: `gradeChange` computes `drawerDelta = owed - value`
(`score.ts:60`), and the tally accumulates it. So the discriminator is there.

- **CONFIRMED mapping.** `drawerDelta > 0` — you handed back **too little** —
  is 6a: the customer notices and gets angry, and is told the amount.
  `drawerDelta < 0` — you handed back **too much** — is 6b: the customer is
  perfectly happy and says nothing, the *shop* is short by that amount, and it
  surfaces in the books. That asymmetry is exactly right for realism: nobody
  corrects you when you overpay them.

**6c — "fix it in the books". CONFIRMED: an end-of-shift reconciliation
screen.** Expected drawer total versus actual, and you enter the discrepancy to
close the shift. Errors accumulate silently during the shift and you face them
all at once, which is precisely how a real till reconciliation works — and it
fits the wall-clock/shift-end rhythm item 8 introduces.

### 7. ID checks (M2 in the plan)

- **Verified in the built code, not assumed from the plan:** `catalog.ts:35`
  already has `readonly ageRestricted: boolean` on `ItemSpec`, and `beer` is
  already an `ItemId` (`catalog.ts:21`). So the data model is in place and this
  item is purely additive.
- **[DRAFT]** Beer and cigarettes prompt an ID check; the customer has a seeded
  apparent age and a possibly-absent or expired ID.
- **Fork 7a — arguing:** is it a real interaction (they push back, you hold or
  fold, refusing correctly earns points) or just a flavour line? **[DRAFT]:**
  real, with a hold/fold choice, since "you might have to argue with them" is
  the interesting half of the request.

### 8. The wall clock

Same shape as 2 and 4: delete the convenient readout, make consulting it a
physical act that costs you. Today `app.tsx:77` renders
`clampSeconds(SHIFT_MS - state.elapsedMs)` as a live countdown — that is the
thing to remove.

- **[DRAFT]** A digital wall clock showing **wall time** (e.g. `21:47`), not a
  countdown. You are told at shift start when it ends (say 23:00) and subtract
  yourself. Looking at it hides the counter, exactly like the shelf head-turn,
  so it cannot be consulted for free while serving.
- **8a — cost of a look. Resolved by the cashier principle:** only the time it
  takes. Glancing at the clock costs you the glance; nobody fines you for it.
- **8b — head-turn, yes.** A wall clock is on the wall. If it were readable
  without looking up it would just be a countdown in a different font, which is
  the thing you asked me to remove.
- **[DRAFT]** Shift end is stated once at the start ("you're on till 23:00"),
  and the clock shows only current wall time. The subtraction is yours. This is
  also why `clampSeconds` and the `<b>{…}s</b>` countdown in `app.tsx:77` go
  away entirely rather than being restyled.

---

## Everything else (unchanged from M0, stated so it is on the record)

- **Stack:** TypeScript 6.0.3, React 19.2.8, Vite 8.2.0, Vitest 4.1.10 — pinned.
- **Commands:** `./run.sh` · `npm run check` (typecheck + lint + coverage) ·
  `npm run build`.
- **Testing:** vitest, colocated `*.test.ts(x)`. 100% on all four metrics with
  zero exclusions; every new branch tested.
- **Structure:** pure logic in `src/core/`, render-only components in `src/ui/`.
  New physical mechanics get their own core module (`scatter.ts`, `drag.ts`)
  rather than growing `shift.ts`.
- **Style:** match the existing core modules — typed, DI, small functions, real
  JSDoc, comments explaining intent and trade-offs.
- **Git:** commit to `main`, never a branch; ask before commit and push.
- **Boundaries:**
  - always: refactor `src/`, add tests, keep the gate green.
  - ask first: any new dependency; any change to the seeded-replay guarantee;
    any lint-rule suppression (there are currently zero).
  - never: `--no-verify`; excluding a file from coverage to reach 100%;
    a second `requestAnimationFrame` owner outside `useGameLoop`;
    `getBoundingClientRect` or any real-layout read in game logic.

## Build order

> ⚠️ **This section is historical.** It planned the original eight items, all of
> which are now built; two of its steps describe code that no longer exists.
> It is kept because the *dependency reasoning* is still the model to copy. For
> what to build next, see "The roadmap" above.

One hard dependency: **6c (reconciliation) cannot precede 3**, since it
reconciles the drawer that item 3 introduces. Otherwise cheapest-first, so each
increment is its own revert point with the gate green:

1. **6a/6b messages** + **item 8 wall clock** + the two readout deletions
   (`IN HAND`, `TENDERED`) — near-free, and the fastest route to a play-check.
2. **2** — the gaze union, head-turn, notebook. *(The notebook was later
   deleted; the gaze union and head-turn shipped.)*
3. **3** — finite drawer + bounded-coin DP + the negotiation options.
4. **6c** — end-of-shift reconciliation. *(Deleted in round three along with
   the cash-up screen — `reconcile.ts` no longer exists.)*
5. **7** — ID checks and arguing.
6. **1** and **4b** — drag-to-scan and scattered money, last because they carry
   the most new geometry.

The `localStorage.clear()` note that stood here applied to the notebook's
persistence and is moot now that the notebook is gone. It becomes live again
the moment anything else persists to `localStorage`: it joins
`vi.unstubAllGlobals()` in `setup.ts`'s `afterEach`, same leak class as the rAF
stub and guarded the same way in `harness.test.ts`.
