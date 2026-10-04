import { createDeck, shuffleDeck } from '../deck';
import { Card } from '../types';

const cardKey = (card: Card): string => `${card.rank}-${card.suit}`;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];

describe('createDeck', () => {
  it('produces exactly 52 unique cards for a single deck, all 13 ranks x 4 suits', () => {
    const deck = createDeck(1);

    expect(deck).toHaveLength(52);

    const keys = deck.map(cardKey);
    expect(new Set(keys).size).toBe(52);

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        expect(keys.filter((k) => k === `${rank}-${suit}`)).toHaveLength(1);
      }
    }
  });

  it('defaults to a single deck when called with no argument', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('produces exactly 312 cards for a 6-deck shoe, with duplicates expected', () => {
    const deck = createDeck(6);

    expect(deck).toHaveLength(312);

    const keys = deck.map(cardKey);
    expect(keys.filter((k) => k === 'A-Spades')).toHaveLength(6);
  });
});

describe('shuffleDeck', () => {
  it('returns a different order in practice', () => {
    const original = createDeck(1);
    const shuffled = shuffleDeck(original);

    expect(shuffled.map(cardKey)).not.toEqual(original.map(cardKey));
  });

  it('returns the same multiset of cards as the input (nothing lost, duplicated, or corrupted)', () => {
    const original = createDeck(1);
    const shuffled = shuffleDeck(original);

    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.map(cardKey).sort()).toEqual(original.map(cardKey).sort());
  });

  it('does not mutate its input argument', () => {
    const original = createDeck(1);
    const originalCopy = original.map((c) => ({ ...c }));

    shuffleDeck(original);

    expect(original).toEqual(originalCopy);
  });

  it('does not return the same array reference as the input', () => {
    const original = createDeck(1);
    const shuffled = shuffleDeck(original);

    expect(shuffled).not.toBe(original);
  });
});
