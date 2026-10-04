# ADR-0008: Rule decisions after the first audit (split 21, leaving, insurance, Phase 5 motion)

## Status
Accepted. Closes the open points of ADR-0004 and audit findings R1, R2, R3, U2

## Date
Decided by Thach 2026-10-04; recorded the same day

## Context
The 2026-10-04 audit (`docs/audit/2026-10-04-audit.md`) found three places
where the code moves money in a way nobody had decided, and an incomplete
Phase 5. Each needed the product owner's call, not an agent's guess.

## Decision

### R1. A + ten after a split is a plain 21
- A natural blackjack exists only on the original two-card hand of a round.
  A two-card 21 on a hand created by a split pays 1:1 like any other win,
  and its `hands` row records `win`, not `blackjack`.
- It does not count in "Blackjacks Hit".
- Implementation: the game layer must know a hand came from a split (for
  example a `fromSplit` flag on `PlayerHandState`); `resolveOutcome` applies
  the natural-blackjack branch only when the hand did not.

### R2. Leaving during the dealer's turn settles the hand first
- Once the player has made every decision (stood, doubled, busted, or the
  last split hand finished), the hand is decided. Leaving during
  `dealerTurn` settles it normally (correct payout, normal `hands` rows),
  then leaves the table. Nothing is forfeited.
- Leaving during `playerTurn` or `insurance` (decisions still open) still
  forfeits the open hand(s), as before (spec section 5b).
- The pending dealer-turn pause and settlement auto-return must not run a
  second time afterwards (same root as audit A2).

### R3. Insurance is built properly
- Offered when the dealer's up-card is an Ace, **before** the dealer checks
  for blackjack. Up-card ten-value: the dealer checks immediately, as today.
- Defaults chosen alongside (change them by a new ADR if Thach disagrees):
  - the insurance stake is half the main bet, rounded down (`Math.floor`);
  - not offered when the player already has a natural blackjack (no
    "even money"); the round goes straight to the dealer's check;
  - "Insurance Yes" is available only when In-Play covers the main bet plus
    the stake (ADR-0003 invariant).
- After the choice, the dealer checks:
  - dealer has blackjack: insurance pays 2:1 (stake back plus twice the
    stake); the main hand loses (or pushes against a player blackjack);
  - dealer has no blackjack: the stake is lost, play continues.
- Storage: no new column (ADR-0001, CLAUDE.md 3.2). The insurance net is
  folded into the In-Play change of the round's first `hands` row, so
  `in_play_after` stays the true running In-Play. The stats queries derived
  from `in_play_after` (Biggest Win) therefore include it; win rate does not
  change.

### U2. Phase 5 gets both animations
- **Hole-card flip:** when the dealer's hole card is revealed it turns over
  (a flip, not a fade or a swap), within the existing dealer-turn pause.
- **Chip movement:** chips move from the In-Play panel to the table when a
  bet is placed (and when a double or insurance adds to it), and back to the
  panel on a win. No mockup shows this, so its session first proposes the
  motion in words (where the bet sits on the table, paths, timing) and waits
  for Thach's approval before building.
- Both must fit inside the pauses of ADR-0005 or extend them explicitly.

## Alternatives considered
- R1 keep 3:2 on split 21: more generous, not casino rule. Rejected.
- R2 forfeit during the dealer's turn: punishes a player whose hand is
  already decided. Rejected.
- R3 remove the prompt: simpler. Rejected by Thach in favour of the real game.
- U2 flip only / neither: rejected by Thach.

## Consequences
- Sessions S2 (R1 + R2), S2b (insurance), S4 (flip) and S5 (chip movement)
  in `SESSION_PROMPT.md` implement this ADR, in that order, after S1.
- Insurance changes the round's state flow (a decision point before the
  dealer's check). It is money logic: doubt-driven review applies.
