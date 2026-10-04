# ADR-0004: House rules

## Status
Accepted. Its three open points were decided in ADR-0008

## Date
Decided during Phases 1-4 (August-September 2026); recorded 2026-10-04

## Context
Blackjack rules vary by casino, and each variant moves money. The rules spec
(`docs/blackjack-game-logic.md`) describes the game but left several variants
as "configurable". Each was decided one at a time, as the code reached it.

## Decision
| Rule | Decided | Where in code |
|---|---|---|
| Dealer on soft 17 | **Stands** (Vegas Strip rule) | `DEALER_CONFIG` in `src/game/gameEngine.ts` |
| Natural blackjack payout | **3:2** (bet 10 wins 15) | `payoutFor` in `src/store/gameStore.ts` |
| Regular win / push / loss | 1:1 / bet returned / bet lost | same |
| Split limit | **Unlimited** re-splits | `playerSplit`, no counter |
| Split Aces | **Unrestricted**: hit, double and re-split allowed | no special case |
| Split eligibility | Two cards of equal **value** (K+Q may split) | `splitValue` |
| Double | Any untouched 2-card hand, including after a split | `playerDouble` |
| Deck | One fresh shuffled 52-card deck every round | `startRound` |
| Dealer peek | Checks for natural blackjack right after the deal | `startRound` |

## Alternatives considered
- **Dealer hits soft 17.** About 0.2% more house edge. Rejected: friendlier
  rule for a practice app.
- **6:5 payout.** Rejected: widely seen as a bad deal; 3:2 is the standard.
- **Split limit of 3 or 4 hands, split Aces get one card.** The casino norm.
  Rejected for simpler code; the UI scrolls to any number of hands
  (ADR-0006).

## Consequences
- Every rule above has a unit test in `src/game/__tests__/` or
  `src/store/__tests__/`. Changing one is a new ADR, not an edit here.

## Open points (all decided 2026-10-04 in ADR-0008; kept here as the question that was asked)
1. **A + ten after a split.** Today `resolveOutcome` treats any 2-card 21 as a
   natural blackjack, so a split hand of A+K is paid 3:2 and counted in
   "Blackjacks Hit". Casino rule: it is a plain 21, paid 1:1. (finding R1)
2. **Insurance.** The Yes/No prompt appears when the dealer shows an Ace, but
   no side bet is taken or paid. Because the dealer peeks first, the prompt
   only ever appears when the dealer does NOT have blackjack, so a real
   insurance bet would always lose. Either build it properly (offered before
   the peek, costs half the bet, pays 2:1) or remove the prompt. (finding R3)
3. **Leaving the table during the dealer's turn.** Forfeits the hand even when
   the player has already won it. (finding R2)
