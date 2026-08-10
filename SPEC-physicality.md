# SPEC: physicality pass — M0 completion conditions

> Status: **ALL EIGHT BUILT — 2026-08-10.** Every item below is implemented,
> tested and pushed, with CI green on each commit. 334 tests, 100% coverage on
> all four metrics, zero exclusions, zero lint suppressions.
>
> **What remains is not code.** M0's done-condition is you playing three shifts
> and saying whether unaided arithmetic under a clock is fun or feels like
> homework. No automated gate can settle that.
>
> Scope as confirmed: all eight at once — finite cash pulled M5's bounded-coin
> DP forward and ID checks pulled M2 forward, so M1 (queue + patience) slips
> behind them. Sections still marked **[DRAFT]** record proposals I built on
> under the cashier principle below; say the word if any reads wrong.

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

So `optimalCount` (the efficiency score's reference, `score.ts:64`) silently
becomes wrong the day the drawer goes finite. It is not a display change.

## M0 is not signed off

Confirmed: you played it, and these eight are what it needs. So this is not a
new milestone bolted onto a finished M0 — **it is M0's completion condition.**
The core loop works; it reads as too abstract. Every item on the list removes
an abstraction and puts a physical action in its place.

That also sets the done-condition for this spec: M0 is signed off when you play
three shifts *with these in* and the arithmetic-under-pressure is fun rather
than homework. No automated gate can settle it.

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

One hard dependency: **6c (reconciliation) cannot precede 3**, since it
reconciles the drawer that item 3 introduces. Otherwise cheapest-first, so each
increment is its own revert point with the gate green:

1. **6a/6b messages** + **item 8 wall clock** + the two readout deletions
   (`IN HAND`, `TENDERED`) — near-free, and the fastest route to a play-check.
2. **2** — the gaze union, head-turn, notebook.
3. **3** — finite drawer + bounded-coin DP + the negotiation options.
4. **6c** — end-of-shift reconciliation.
5. **7** — ID checks and arguing.
6. **1** and **4b** — drag-to-scan and scattered money, last because they carry
   the most new geometry.

`localStorage.clear()` joins `vi.unstubAllGlobals()` in `setup.ts`'s `afterEach`
the moment the notebook persists anything — same leak class as the rAF stub
fixed earlier today, and guarded the same way in `harness.test.ts`.
