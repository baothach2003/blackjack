import { createDeck, shuffleDeck } from './deck';
import { DealerConfig, dealerShouldHit } from './rules';
import { calculateScore, isBust, isNaturalBlackjack } from './scoring';
import { Card, Rank } from './types';

// docs/blackjack-app-spec.md section 5b: confirmed Vegas Strip rule. Every call
// into dealerShouldHit from this file goes through this constant — change it here,
// not at the call sites.
export const DEALER_CONFIG: DealerConfig = { dealerHitsSoftSeventeen: false };

export type Outcome = 'win' | 'lose' | 'push' | 'blackjack';

export type RoundPhase = 'betting' | 'dealing' | 'playerTurn' | 'dealerTurn' | 'settlement';

export interface PlayerHandState {
  cards: Card[];
  bet: number;
  isDoubled: boolean;
  isStood: boolean;
  isBusted: boolean;
}

export interface GameState {
  deck: Card[];
  dealerHand: Card[];
  playerHands: PlayerHandState[];
  currentHandIndex: number;
  roundPhase: RoundPhase;
}

// docs/blackjack-game-logic.md section 7.1, priority order preserved exactly.
export function resolveOutcome(playerHand: Card[], dealerHand: Card[]): Outcome {
  if (isBust(playerHand)) {
    return 'lose';
  }

  const playerBlackjack = isNaturalBlackjack(playerHand);
  const dealerBlackjack = isNaturalBlackjack(dealerHand);

  if (playerBlackjack && dealerBlackjack) {
    return 'push';
  }
  if (playerBlackjack) {
    return 'blackjack';
  }
  if (dealerBlackjack) {
    return 'lose';
  }

  if (isBust(dealerHand)) {
    return 'win';
  }

  const playerScore = calculateScore(playerHand).score;
  const dealerScore = calculateScore(dealerHand).score;

  if (playerScore > dealerScore) {
    return 'win';
  }
  if (playerScore < dealerScore) {
    return 'lose';
  }
  return 'push';
}

function draw(deck: Card[]): Card {
  const card = deck.pop();
  if (!card) {
    throw new Error('No cards left in the deck');
  }
  return card;
}

function isHandFinished(hand: PlayerHandState): boolean {
  return hand.isStood || hand.isBusted;
}

// Moves focus to the next unfinished hand (for split), or hands off to the
// dealer once every player hand is stood/busted.
function advanceTurn(state: GameState): GameState {
  for (let i = state.currentHandIndex + 1; i < state.playerHands.length; i += 1) {
    if (!isHandFinished(state.playerHands[i])) {
      return { ...state, currentHandIndex: i };
    }
  }
  return { ...state, roundPhase: 'dealerTurn' };
}

// docs/blackjack-game-logic.md section 3: bet, shuffle, deal 2 cards each,
// check for an immediate natural blackjack before opening the player's turn.
export function startRound(bet: number, numberOfDecks: number = 1): GameState {
  const deck = shuffleDeck(createDeck(numberOfDecks));

  const playerCards: Card[] = [];
  const dealerCards: Card[] = [];

  playerCards.push(draw(deck));
  dealerCards.push(draw(deck));
  playerCards.push(draw(deck));
  dealerCards.push(draw(deck));

  const playerHand: PlayerHandState = {
    cards: playerCards,
    bet,
    isDoubled: false,
    isStood: false,
    isBusted: false,
  };

  const roundIsAlreadyOver = isNaturalBlackjack(playerCards) || isNaturalBlackjack(dealerCards);

  return {
    deck,
    dealerHand: dealerCards,
    playerHands: [playerHand],
    currentHandIndex: 0,
    roundPhase: roundIsAlreadyOver ? 'settlement' : 'playerTurn',
  };
}

// docs/blackjack-game-logic.md section 4: draw one card into the active hand.
export function playerHit(state: GameState): GameState {
  const deck = [...state.deck];
  const card = draw(deck);

  const playerHands = state.playerHands.map((hand, index) => {
    if (index !== state.currentHandIndex) return hand;
    const cards = [...hand.cards, card];
    return { ...hand, cards, isBusted: isBust(cards) };
  });

  const nextState = { ...state, deck, playerHands };
  return playerHands[state.currentHandIndex].isBusted ? advanceTurn(nextState) : nextState;
}

export function playerStand(state: GameState): GameState {
  const playerHands = state.playerHands.map((hand, index) =>
    index === state.currentHandIndex ? { ...hand, isStood: true } : hand,
  );
  return advanceTurn({ ...state, playerHands });
}

// docs/blackjack-game-logic.md section 4: only on an untouched 2-card hand,
// doubles the bet, draws exactly one card, then mandatory stand.
export function playerDouble(state: GameState): GameState {
  const currentHand = state.playerHands[state.currentHandIndex];
  if (currentHand.cards.length !== 2) {
    throw new Error('Double is only allowed on a 2-card hand');
  }

  const deck = [...state.deck];
  const card = draw(deck);
  const cards = [...currentHand.cards, card];

  const doubledHand: PlayerHandState = {
    ...currentHand,
    cards,
    bet: currentHand.bet * 2,
    isDoubled: true,
    isStood: true,
    isBusted: isBust(cards),
  };

  const playerHands = state.playerHands.map((hand, index) =>
    index === state.currentHandIndex ? doubledHand : hand,
  );

  return advanceTurn({ ...state, deck, playerHands });
}

export function splitValue(rank: Rank): number {
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  if (rank === 'A') return 11;
  return Number(rank);
}

// docs/blackjack-game-logic.md section 8: the active hand becomes two
// independent hands, each with its own bet/state, each immediately dealt one
// card back up to a normal 2-card hand.
export function playerSplit(state: GameState): GameState {
  const currentHand = state.playerHands[state.currentHandIndex];
  const [first, second] = currentHand.cards;

  if (currentHand.cards.length !== 2 || splitValue(first.rank) !== splitValue(second.rank)) {
    throw new Error('Split requires exactly 2 cards of matching value');
  }

  const deck = [...state.deck];
  const firstHandCard = draw(deck);
  const secondHandCard = draw(deck);

  const handA: PlayerHandState = {
    cards: [first, firstHandCard],
    bet: currentHand.bet,
    isDoubled: false,
    isStood: false,
    isBusted: false,
  };
  const handB: PlayerHandState = {
    cards: [second, secondHandCard],
    bet: currentHand.bet,
    isDoubled: false,
    isStood: false,
    isBusted: false,
  };

  const playerHands = [...state.playerHands];
  playerHands.splice(state.currentHandIndex, 1, handA, handB);

  return { ...state, deck, playerHands };
}

// docs/blackjack-game-logic.md section 5: fixed dealer rules, no discretion,
// no player input involved.
export function playDealerTurn(state: GameState): GameState {
  const deck = [...state.deck];
  let dealerHand = [...state.dealerHand];

  while (dealerShouldHit(dealerHand, DEALER_CONFIG)) {
    dealerHand = [...dealerHand, draw(deck)];
  }

  return { ...state, deck, dealerHand, roundPhase: 'settlement' };
}
