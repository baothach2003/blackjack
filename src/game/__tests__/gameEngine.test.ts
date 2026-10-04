import {
  DEALER_CONFIG,
  GameState,
  playDealerTurn,
  playerSplit,
  playerStand,
  resolveOutcome,
  startRound,
} from '../gameEngine';
import { calculateScore } from '../scoring';
import { Card } from '../types';

const card = (rank: Card['rank'], suit: Card['suit'] = 'Spades'): Card => ({ rank, suit });

describe('resolveOutcome', () => {
  it('is "lose" when the player busts, regardless of the dealer', () => {
    const playerHand = [card('10'), card('9'), card('5')]; // 24, bust
    const dealerHand = [card('10'), card('9'), card('5')]; // also 24, irrelevant
    expect(resolveOutcome(playerHand, dealerHand)).toBe('lose');
  });

  it('is "push" when both player and dealer have a natural blackjack', () => {
    const playerHand = [card('A'), card('K')];
    const dealerHand = [card('A'), card('Q')];
    expect(resolveOutcome(playerHand, dealerHand)).toBe('push');
  });

  it('is "blackjack" when only the player has a natural blackjack', () => {
    const playerHand = [card('A'), card('K')];
    const dealerHand = [card('10'), card('9')]; // 19
    expect(resolveOutcome(playerHand, dealerHand)).toBe('blackjack');
  });

  it('is "lose" when only the dealer has a natural blackjack', () => {
    const playerHand = [card('10'), card('9')]; // 19
    const dealerHand = [card('A'), card('K')];
    expect(resolveOutcome(playerHand, dealerHand)).toBe('lose');
  });

  it('is "win" when the dealer busts and the player has not', () => {
    const playerHand = [card('10'), card('9')]; // 19
    const dealerHand = [card('10'), card('9'), card('5')]; // 24, bust
    expect(resolveOutcome(playerHand, dealerHand)).toBe('win');
  });

  it('is "win" when neither busts and the player has the higher total', () => {
    const playerHand = [card('10'), card('9')]; // 19
    const dealerHand = [card('10'), card('8')]; // 18
    expect(resolveOutcome(playerHand, dealerHand)).toBe('win');
  });

  it('is "lose" when neither busts and the dealer has the higher total', () => {
    const playerHand = [card('10'), card('8')]; // 18
    const dealerHand = [card('10'), card('9')]; // 19
    expect(resolveOutcome(playerHand, dealerHand)).toBe('lose');
  });

  it('is "push" when neither busts and totals are equal', () => {
    const playerHand = [card('10'), card('8')]; // 18
    const dealerHand = [card('9'), card('9')]; // 18
    expect(resolveOutcome(playerHand, dealerHand)).toBe('push');
  });
});

describe('full round flow: startRound -> playerStand -> playDealerTurn', () => {
  it('resolves to a sensible outcome', () => {
    let state = startRound(10);

    // A natural blackjack on the deal skips straight to settlement; otherwise
    // stand and let the dealer play out.
    if (state.roundPhase === 'playerTurn') {
      state = playerStand(state);
    }
    if (state.roundPhase === 'dealerTurn') {
      state = playDealerTurn(state);
    }

    expect(state.roundPhase).toBe('settlement');
    expect(state.playerHands).toHaveLength(1);

    const outcome = resolveOutcome(state.playerHands[0].cards, state.dealerHand);
    expect(['win', 'lose', 'push', 'blackjack']).toContain(outcome);
  });
});

describe('playerSplit', () => {
  it('splits a matching pair into two independent hands, each separately playable and resolved', () => {
    const eightSpades = card('8', 'Spades');
    const eightHearts = card('8', 'Hearts');
    const drawForHandA = card('3', 'Diamonds'); // hand A becomes 8+3 = 11
    const drawForHandB = card('K', 'Clubs'); // hand B becomes 8+K = 18

    const initialState: GameState = {
      deck: [drawForHandB, drawForHandA], // pop() order: drawForHandA first, then drawForHandB
      dealerHand: [card('10', 'Hearts'), card('8', 'Diamonds')], // 18, already stands
      playerHands: [
        {
          cards: [eightSpades, eightHearts],
          bet: 10,
          isDoubled: false,
          isStood: false,
          isBusted: false,
        },
      ],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };

    const afterSplit = playerSplit(initialState);

    expect(afterSplit.playerHands).toHaveLength(2);
    expect(afterSplit.playerHands[0].cards).toEqual([eightSpades, drawForHandA]);
    expect(afterSplit.playerHands[1].cards).toEqual([eightHearts, drawForHandB]);
    expect(afterSplit.playerHands[0].bet).toBe(10);
    expect(afterSplit.playerHands[1].bet).toBe(10);
    expect(afterSplit.currentHandIndex).toBe(0);

    const afterHand1Stand = playerStand(afterSplit);
    expect(afterHand1Stand.playerHands[0].isStood).toBe(true);
    expect(afterHand1Stand.currentHandIndex).toBe(1);
    expect(afterHand1Stand.roundPhase).toBe('playerTurn');

    const afterHand2Stand = playerStand(afterHand1Stand);
    expect(afterHand2Stand.playerHands[1].isStood).toBe(true);
    expect(afterHand2Stand.roundPhase).toBe('dealerTurn');

    const finalState = playDealerTurn(afterHand2Stand);
    expect(finalState.roundPhase).toBe('settlement');
    expect(finalState.dealerHand).toEqual(initialState.dealerHand); // 18 already stands, no hit

    const outcome1 = resolveOutcome(finalState.playerHands[0].cards, finalState.dealerHand);
    const outcome2 = resolveOutcome(finalState.playerHands[1].cards, finalState.dealerHand);

    expect(outcome1).toBe('lose'); // 11 vs 18
    expect(outcome2).toBe('push'); // 18 vs 18
  });
});

describe('playDealerTurn', () => {
  it('stops exactly when dealerShouldHit would return false: stands on soft 17 without hitting', () => {
    expect(DEALER_CONFIG.dealerHitsSoftSeventeen).toBe(false);

    const dealerHand = [card('A'), card('6')]; // soft 17
    const deck = [card('2')]; // would be drawn if it incorrectly hit

    const state: GameState = {
      deck,
      dealerHand,
      playerHands: [
        { cards: [card('10'), card('9')], bet: 10, isDoubled: false, isStood: true, isBusted: false },
      ],
      currentHandIndex: 0,
      roundPhase: 'dealerTurn',
    };

    const result = playDealerTurn(state);

    expect(result.dealerHand).toEqual(dealerHand);
    expect(result.deck).toHaveLength(1); // untouched
    expect(result.roundPhase).toBe('settlement');
  });

  it('keeps hitting below 17 and stops once it reaches 17 or above', () => {
    const state: GameState = {
      deck: [card('9'), card('6')], // pop() order: 6 first, then 9
      dealerHand: [card('2'), card('3')], // 5, must hit
      playerHands: [
        { cards: [card('10'), card('9')], bet: 10, isDoubled: false, isStood: true, isBusted: false },
      ],
      currentHandIndex: 0,
      roundPhase: 'dealerTurn',
    };

    const result = playDealerTurn(state);

    // 2 + 3 + 6 + 9 = 20
    expect(calculateScore(result.dealerHand).score).toBe(20);
    expect(result.deck).toHaveLength(0);
    expect(result.roundPhase).toBe('settlement');
  });
});
