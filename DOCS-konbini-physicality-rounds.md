# Physicality pass: play-test rounds

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
| 6 | **Sound effects**, ten CC0 `.ogg` files, credited — the original four at the counter, plus six for the hot case, the stockroom, cleaning and an impatient customer | `sound.ts`, `use-sound-cues.ts`, `CREDITS.md` |
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
