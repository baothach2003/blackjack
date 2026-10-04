import { calculateScore, isBust, isNaturalBlackjack } from '../scoring';
import { Card } from '../types';

const card = (rank: Card['rank'], suit: Card['suit'] = 'Spades'): Card => ({ rank, suit });

describe('calculateScore', () => {
  it('sums a plain hard hand with no Aces', () => {
    expect(calculateScore([card('9'), card('8')])).toEqual({ score: 17, isSoft: false });
  });

  it('counts face cards as 10', () => {
    expect(calculateScore([card('K'), card('Q')])).toEqual({ score: 20, isSoft: false });
  });

  // Section 10: "Hands with multiple Aces (e.g. Ace + Ace + 9 must resolve to
  // 21, not 31 or an incorrect bust)."
  it('resolves Ace + Ace + 9 to 21, not 31 or a bust', () => {
    const result = calculateScore([card('A'), card('A'), card('9')]);
    expect(result.score).toBe(21);
    expect(result.isSoft).toBe(true);
    expect(isBust([card('A'), card('A'), card('9')])).toBe(false);
  });

  it('converts every Ace down to 1 when even that still busts', () => {
    // A + A + A + A + K -> 11*4 + 10 = 54 -> convert all four Aces -> 14
    const result = calculateScore([card('A'), card('A'), card('A'), card('A'), card('K')]);
    expect(result.score).toBe(14);
    expect(result.isSoft).toBe(false);
  });

  // Section 10: "Soft 17 vs. hard 17, to correctly test the dealer's hit/stand rule."
  it('flags a soft 17 (Ace counted as 11) correctly', () => {
    expect(calculateScore([card('A'), card('6')])).toEqual({ score: 17, isSoft: true });
  });

  it('flags a hard 17 (no Ace, or Ace forced down to 1) correctly', () => {
    expect(calculateScore([card('10'), card('7')])).toEqual({ score: 17, isSoft: false });
  });

  it('turns a soft hand hard once its Ace is forced down to 1', () => {
    // A + 6 + 9 -> 11+6+9 = 26 -> convert the Ace -> 16, hard
    expect(calculateScore([card('A'), card('6'), card('9')])).toEqual({
      score: 16,
      isSoft: false,
    });
  });
});

describe('isBust', () => {
  it('is false for a hand at exactly 21', () => {
    expect(isBust([card('K'), card('A')])).toBe(false);
  });

  // Section 10: "Busting exactly on the 3rd card after a hit."
  it('is true when the 3rd card pushes the total past 21', () => {
    expect(isBust([card('10'), card('7'), card('5')])).toBe(true);
  });

  it('is false when the 3rd card keeps the total at or under 21', () => {
    expect(isBust([card('5'), card('5'), card('5')])).toBe(false);
  });
});

describe('isNaturalBlackjack', () => {
  it('is true for an Ace + 10-value card 2-card hand', () => {
    expect(isNaturalBlackjack([card('A'), card('K')])).toBe(true);
  });

  it('is false for a 2-card hand totaling less than 21', () => {
    expect(isNaturalBlackjack([card('9'), card('9')])).toBe(false);
  });

  it('is false for a 21 reached with more than 2 cards', () => {
    expect(isNaturalBlackjack([card('7'), card('7'), card('7')])).toBe(false);
  });

  // Section 10: "Both sides having a natural blackjack simultaneously (a
  // special push case that's easy to mistakenly code as a regular win/lose)."
  // isNaturalBlackjack only needs to report true for each hand independently —
  // deciding that this is a push is resolveOutcome's job, not scoring's.
  it('is true independently for both player and dealer when both have a natural blackjack', () => {
    const playerHand = [card('A'), card('K')];
    const dealerHand = [card('A'), card('Q')];

    expect(isNaturalBlackjack(playerHand)).toBe(true);
    expect(isNaturalBlackjack(dealerHand)).toBe(true);
  });
});
