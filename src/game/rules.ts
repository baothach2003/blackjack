import { calculateScore } from './scoring';
import { Card } from './types';

export interface DealerConfig {
  dealerHitsSoftSeventeen: boolean;
}

// docs/blackjack-game-logic.md section 5: below 17 always hits, 17+ always
// stands, except a soft 17 hits only when the house config says so.
export function dealerShouldHit(hand: Card[], config: DealerConfig): boolean {
  const { score, isSoft } = calculateScore(hand);

  if (score < 17) {
    return true;
  }

  if (score === 17 && isSoft && config.dealerHitsSoftSeventeen) {
    return true;
  }

  return false;
}
