import { Card, Rank, Suit } from './types';

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];

export function createDeck(numberOfDecks: number = 1): Card[] {
  const deck: Card[] = [];

  for (let i = 0; i < numberOfDecks; i += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
  }

  return deck;
}

// Fisher-Yates: walk the array backwards, swapping each slot with a uniformly
// random earlier (or same) slot. Never mutates the input.
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}
