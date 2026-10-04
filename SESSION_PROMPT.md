# SESSION PROMPT (reusable)

How to use: open a new Claude Code session in the repo root, paste everything
between the two lines below, then replace the SCOPE block with the next one
from "Ready-made scopes" at the bottom (or the next item in
`docs/project-plan.md` Current Status). Change nothing else.

------------------------------------------------------------------------------

Before doing anything, read in this order and follow them strictly:
1. `CLAUDE.md` (the rules of this repo; it wins over any installed skill)
2. `docs/project-plan.md`, section "Current Status"
3. `CONSTRAINTS.md`
4. Every file named in the SCOPE block below, and the ADRs in `docs/adr/` it
   touches

SCOPE OF THIS SESSION - do this and nothing more
<<< paste one scope block here >>>

RULES FOR THIS SESSION
- One scope only. Finishing early is fine; starting the next scope is not.
- Bug fixes are test-first: write the failing test that reproduces the bug,
  show it failing, then fix, then show it passing.
- STOP and ask Thach (do not guess) when: a fix needs a rule or product
  decision that is not in `docs/` or `docs/adr/`; a Floor rule in
  `CONSTRAINTS.md` would have to be loosened; the change grows beyond the
  files the scope names.
- Never claim something looks or feels right on screen. List exactly what
  Thach must check in Expo Go instead.

END OF SESSION (mandatory, in this order)
1. Run every Floor check in `CONSTRAINTS.md` and paste the real output
   (`npx tsc --noEmit`, `npx eslint src/ --max-warnings=0`, `npx jest`,
   the debug-leftover grep).
2. Explain to Thach in Vietnamese, in chat: what changed, why, which
   decisions you made alone and why. Every file, comment and commit message
   stays in English.
3. List what Thach must check on the device, step by step.
4. Rewrite (overwrite, do not append) the "Current Status" section of
   `docs/project-plan.md`: done this session, next scope, open questions.
   Keep it under 25 lines.
5. Propose the exact `git add` / `git commit -m "..."` commands. Do not run
   them, and never push.

------------------------------------------------------------------------------

## Ready-made scopes

### S0 - Install engineering skills (tooling only, no app code)

```
Install the skills listed in docs/SKILLS.md section 2. Write no app code.
1. `git status` must be clean; stop if not. `node --version` must work.
2. From the repo root, one command:
   npx skills add addyosmani/agent-skills -a claude-code --copy -y -s incremental-implementation -s test-driven-development -s debugging-and-error-recovery -s frontend-ui-engineering -s doubt-driven-development
   Install nothing that is not in docs/SKILLS.md section 2.
3. Clone https://github.com/addyosmani/agent-skills (depth 1) into a temp
   folder OUTSIDE this repo. Copy into this repo: the reference files named in
   docs/SKILLS.md section 2 into .claude/references/, and LICENSE to
   .claude/THIRD_PARTY_LICENSES/agent-skills-LICENSE. Delete the temp clone.
4. Show evidence: `npx skills list` shows exactly the five skills; every
   `../../references/<file>.md` link in the installed SKILL.md files points to
   a file that exists; skills-lock.json exists; `npx jest` still passes.
Commit message to propose: chore: install engineering agent skills
```

### S1 - Fix the two blocking money bugs (audit A1, A2) and gate the dev tool (H1)

```
Read docs/audit/2026-10-04-audit.md (findings A1, A2, H1 and their
reproductions), docs/adr/0003-balance-and-in-play.md and
docs/adr/0005-settlement-feedback.md first.

A1 - In-Play can go negative.
- Turn the audit's A1 reproduction into a failing regression test asserting
  the CORRECT behaviour.
- Fix: Double and Split are allowed only when In-Play covers every chip at
  risk afterwards: (sum of all current hands' bets) + (the extra stake) <=
  In-Play. Enforce it in two places: the eligibility the store derives
  (canDouble / canSplit, so the button is disabled or absent) AND inside the
  double() / split() actions themselves (a guard, so no caller can bypass the
  UI). Keep src/game/ pure: the engine knows nothing about In-Play.
- Add an invariant test: across a sequence of rounds mixing bet-all, double
  and split, In-Play is never negative and Leave The Table always succeeds.

A2 - The settlement auto-return timer is never cancelled.
- Turn the audit's A2 reproduction into a failing regression test, plus one
  for "a new session starts inside the pause and the old timer must not touch
  it".
- Fix: keep a handle to the pending timer and cancel it in leaveTable(),
  confirmLeaveTable() and startBuyIn(); or make the callback check that the
  session it was created for is still the current one. Pick one, say why.

H1 - Show the Settings "Reset Test Balance" row only when __DEV__ is true.

Out of scope: R1, R2, R3 (sessions S2 and S2b), U1, H2, any visual change,
Phase 6.
After the fix, mark A1/A2/H1 as fixed in the audit file (append the commit
date and a one-line summary; do not delete the finding).
Commit message to propose: fix: keep In-Play non-negative and cancel the settlement timer on leave
```

### S2 - Split 21 pays 1:1 (R1) and leaving settles a decided hand (R2)

```
Read docs/adr/0008-rule-decisions-after-audit.md (sections R1, R2) and the
audit's R1/R2 reproductions first. S1 must be done (A2's timer fix is the
base R2 builds on).

R1 - a two-card 21 on a hand created by a split is a plain win (1:1,
recorded 'win', not counted in Blackjacks Hit). The game layer must know a
hand came from a split; keep src/game/ pure. Failing tests first: the audit's
R1 reproduction asserting 1:1, plus "an original-hand blackjack still pays
3:2" so the change cannot overreach.

R2 - confirmLeaveTable during 'dealerTurn' settles the round normally first
(correct payouts and hands rows), then leaves; the pending dealer-turn pause
and the settlement timer must not fire afterwards. 'playerTurn' and
'insurance' still forfeit, as before. Failing tests first: the audit's R2
reproduction asserting Balance 1,050 (the 50 win paid), plus one proving
leaving during playerTurn still forfeits.

Money logic: run doubt-driven-development on both changes before calling the
session done.
Commit message to propose: fix: pay split 21 at 1:1 and settle a decided hand before leaving
```

### S2b - Real insurance (R3)

```
Read docs/adr/0008-rule-decisions-after-audit.md section R3 first; it is the
spec. Today startRound peeks for dealer blackjack immediately and the
insurance prompt is a no-op (takeInsurance only dismisses it).

Build:
- Dealer up-card Ace and the player has no natural: phase 'insurance' BEFORE
  the dealer's check. Up-card ten-value: check immediately, as today. Player
  has a natural: no insurance, straight to the check.
- Stake = Math.floor(bet / 2). "Insurance Yes" only if In-Play covers bet +
  stake (disabled otherwise, and guarded inside the action).
- After the choice, the dealer checks: blackjack -> insurance pays 2:1, main
  hand resolves (lose, or push against a player natural); no blackjack ->
  stake lost, play continues to playerTurn.
- The insurance net is folded into the In-Play change of the round's first
  hands row (no new column).
- Remove the now-wrong comment above takeInsurance, and use or remove the
  unused insuranceResolved state.
Failing tests first, hand-computed, for: insured + dealer blackjack (net 0 on
the round), insured + no dealer blackjack (lose the stake, play on),
declined + dealer blackjack, up-card ten-value (no prompt), player natural
vs dealer Ace (no prompt), In-Play too low (Yes unavailable). Run
doubt-driven-development before calling the session done.
Device check list for Thach must include the full insurance flow.
Commit message to propose: feat: real insurance offered before the dealer checks for blackjack
```

### S3 - Cleanup (U1, H2)

```
U1: add the "Bust" label to a busted split hand per the design
(design/mockups/Split Hands.png). H2: delete src/hooks/useGameState.ts and
src/components/TickSlider.tsx. Grep first; delete only what nothing imports.
If src/hooks/ ends up empty, remove the folder and its rule in
src/__tests__/architecture.test.ts (removing a rule for a folder that no
longer exists is not relaxing the test - say so in the report).
Commit message to propose: chore: bust label on split hands, remove dead code
```

### S4 - Hole-card flip (U2, part 1)

```
Read docs/adr/0008 (U2), docs/adr/0005 (pauses) and Card.tsx's comment about
the flip "not built yet". When the dealer's hole card is revealed it turns
over (a flip, reanimated, rotateY or scaleX), inside the existing dealer-turn
pause. If the flip needs more time than the pause gives, extend
dealerTurnPauseMs explicitly and update ADR-0005's numbers. No change to game
or money logic. Device check list: flip visible on stand, double, after a
split, and on a dealer natural.
Commit message to propose: feat: flip animation for the dealer's hole card
```

### S5 - Chip movement (U2, part 2) - design first

```
No mockup shows this. STEP 1, then STOP: propose the motion in words for
Thach to approve - where the bet sits on the table, the path chips take from
the In-Play panel on a bet / double / insurance and back on a win, timing,
and how it fits the pauses in ADR-0005. Build only after Thach approves, and
record the approved motion as a line in docs/blackjack-app-spec.md section 5b.
Commit message to propose: feat: chip movement for bets and payouts
```
