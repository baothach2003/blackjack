import { Card, Rank } from './types';

export interface ScoreResult {
  score: number;
  isSoft: boolean;
}

function numericValue(rank: Rank): number {
  return Number(rank);
}

// Ace-handling per docs/blackjack-game-logic.md section 6.2: default every Ace to
// 11, then convert Aces from 11 to 1 one at a time only while busting.
export function calculateScore(hand: Card[]): ScoreResult {
  let total = 0;
  let aceCount = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      total += 11;
      aceCount += 1;
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
      total += 10;
    } else {
      total += numericValue(card.rank);
    }
  }

  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount -= 1;
  }

  const isSoft = aceCount > 0;
  return { score: total, isSoft };
}

export function isBust(hand: Card[]): boolean {
  return calculateScore(hand).score > 21;
}

export function isNaturalBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && calculateScore(hand).score === 21;
}
