# ADR-0005: No result overlay; the In-Play number reports the outcome

## Status
Accepted. Supersedes `docs/blackjack-app-spec.md` section 3.10 (Result overlay)

## Date
Decided during Phase 5 on-device testing (September 2026); recorded 2026-10-04

## Context
The first build showed a Win/Lose/Push/Bust/Blackjack overlay with a "Next
Hand" button after every hand. On-device it slowed the rhythm of play: one
extra tap per hand. A hybrid (no overlay except for a natural blackjack) was
considered and rejected by the product owner.

## Decision
- No overlay or banner for any outcome, natural blackjack included.
- Settlement feedback is the In-Play number itself (`AnimatedNumber`): it
  counts to the new value and pulses green when the hand's net is positive,
  red when negative, no colour when zero (push). With several split hands the
  colour follows their summed net.
- The sequence is fixed: the dealer's hand is revealed and held
  (`dealerTurnPauseMs`, at least `DEALER_TURN_DISPLAY_MS` = 1200 ms and longer
  when the dealer draws), then settlement, then an automatic return to the
  Place Bet Sheet after `SETTLEMENT_PAUSE_MS` = 1800 ms. No button to tap.
- Every money figure that changes animates through intermediate values
  (`AnimatedNumber`), one shared component. The Buy-in slider's live Balance
  is the exception: it follows the finger directly.

## Alternatives considered
- **Keep the overlay.** Clear, but one tap per hand. Rejected.
- **Overlay for natural blackjack only.** Keeps the moment special. Rejected
  by the product owner for consistency.

## Consequences
- A push is quiet: the number may move back to where it was with no colour.
  Easy to miss; accepted.
- The auto-return is a timer. Any action that ends the session (Leave The
  Table) must cancel it. **Known violation (audit 2026-10-04, finding A2):**
  today the timer still fires after leaving and flips the screen back to
  betting with no session. Fixed in session S1.
- The pause values are pacing choices confirmed on-device, not derived
  constants; change them in one place, `src/store/gameStore.ts`.
