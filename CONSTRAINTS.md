# Constraints

Last reviewed: 2026-10-04 (drafted after the first full audit, decisions approved by Thach)

The measurable quality bar for this app. How the agent works lives in
`CLAUDE.md`; what the product does lives in `docs/blackjack-app-spec.md` and
`docs/blackjack-game-logic.md`. This file holds only the gates on code: what is
checked, by which command, and whether a failure blocks. On a conflict with
another source-of-truth file, stop and reconcile with Thach (`CLAUDE.md`
section 1).

Enforcement: the agent runs every Floor check at the end of each session and
reports the output. CI (`.github/workflows/ci.yml`) runs the same commands on
every push to `main` and on every pull request.

"The diff" below means `git diff HEAD` plus every untracked file listed by
`git ls-files --others --exclude-standard`. Plain `git diff` misses new files.

## Floor (blocks: the session is not done while any of these fails)

| # | Rule | Checked by |
|---|---|---|
| F1 | Every test passes: no failed, skipped or todo test | `npx jest` (all suites, never watch mode) |
| F2 | No test weakened or switched off: no deleted test file, no removed assertion in a test that stays, no new `.skip`, `.only`, `.todo`, `xit`, `xdescribe`, and no `testPathIgnorePatterns` added | review of the diff over every `__tests__/` folder and `package.json`'s `jest` block |
| F3 | `src/__tests__/architecture.test.ts` is never relaxed or deleted. Extending it to a new boundary is allowed. Its "flags a planted violation" cases must keep passing | the test passes; every diff to the file is reviewed and adds no allowed layer or package without Thach's approval |
| F4 | TypeScript compiles in strict mode with zero errors | `npx tsc --noEmit` |
| F5 | No new lint warnings | `npx eslint src/ --max-warnings=0` |
| F6 | No `@ts-ignore`, no `@ts-nocheck`. `@ts-expect-error` only with a reason on the same line. `eslint-disable` only for one named rule with a reason | search the diff |
| F7 | No debug leftovers: no `console.log`, no `[... DEBUG]` instrumentation, no temporary probe test file | `grep -rn "console.log\|DEBUG" src/` returns nothing |
| F8 | Money invariants hold: In-Play is never negative; Balance changes only through Buy-in, re-buy and Leave The Table (`docs/adr/0003-balance-and-in-play.md`) | the invariant tests in `src/store/__tests__/`. **Fails today** (audit A1); session S1 adds the tests and the fix, and from then on it blocks |
| F9 | This file is never loosened to make a change pass. Tightening is fine. Loosening needs Thach's explicit approval, recorded in the Change log below | `git diff HEAD -- CONSTRAINTS.md` reviewed on every commit that touches it |

## Warn (reported at session end; does not block)

| # | Rule | Checked by |
|---|---|---|
| W1 | Any new function in `src/game/`, `src/storage/` or `src/store/` has a test whose expected value was worked out by hand, not copied from the output | review of the diff |
| W2 | No npm dependency vulnerability at high severity or above | `npm audit --audit-level=high` (needs the network) |
| W3 | Every screen touched in the session was checked on a real device via Expo Go | stated in the session report, with what was looked at |

W3 is a warning, not a floor rule, only because the agent cannot hold the
phone: it lists exactly what Thach must check, and the session item stays open
until Thach confirms.

## Exceptions

A new exception needs an owner and an expiry at most 90 days out, added under
the F9 process.

| ID | Rule | Path | Reason | Owner | Expires |
|---|---|---|---|---|---|
| - | - | - | none yet | - | - |

## Change log

- 2026-10-04: file created (F1-F9, W1-W3) after the first full audit.
