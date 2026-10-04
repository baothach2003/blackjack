# ADR-0003: Two money figures, Balance and In-Play

## Status
Accepted

## Date
Decided at the design review (August 2026); recorded 2026-10-04

## Context
A simpler design (one balance, bet straight from it) was proposed first. The
product owner chose the casino model instead: you buy chips into a table, play
from that stack, and cash out when you leave. Two figures that look alike are
easy to confuse in code, and confusing them means money appears or vanishes.

## Decision
- **Balance**: the whole-app wallet (`wallet.balance`), shown in headers.
- **In-Play**: the chips bought into the current table session. Exists only
  while a session is open.
- Balance changes in exactly three places: Buy-in (debit, opens a session),
  mid-game re-buy (debit, adds to the same session's In-Play), Leave The Table
  (credit the remaining In-Play, closes the session). Nothing else writes
  Balance; there is no generic setter. The one exception,
  `resetBalanceForTesting`, is a dev-only tool (see Consequences).
- Hit, Stand, Double, Split and settlement change In-Play only, through the
  `hands` table.
- **Invariant: In-Play is never negative.** A bet, a double or a split is
  allowed only if every chip it could lose is covered by In-Play.
- When In-Play reaches 0 the mid-game Buy-in Sheet offers a re-buy or Leave
  The Table.

## Alternatives considered
- **One balance, bet directly from it.** Simpler code. Rejected by the product
  owner: the buy-in is part of the casino feel the app is after.
- **Debit In-Play when the bet is placed** (instead of at settlement). Would
  make the invariant automatic, but changes every payout calculation and the
  meaning of `in_play_after`. Not adopted yet; the invariant is enforced by
  eligibility checks instead.

## Consequences
- Double and Split eligibility must include an affordability check, not only
  the card check. **Known violation (audit 2026-10-04, finding A1):** today
  they do not, so In-Play can go negative and Leave The Table then throws.
  Fixed in session S1 (`docs/project-plan.md` Current Status).
- A re-buy is not recorded as its own row; `getCurrentInPlay` cannot rebuild
  In-Play after a cold restart mid-session (Backlog: session resume).
- `resetBalanceForTesting` bypasses the three write paths on purpose. It must
  stay unreachable in a release build (`__DEV__` only).
