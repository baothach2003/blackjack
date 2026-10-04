import { dealerShouldHit, DealerConfig } from '../rules';
import { Card } from '../types';

const card = (rank: Card['rank'], suit: Card['suit'] = 'Spades'): Card => ({ rank, suit });

const hitsSoft17: DealerConfig = { dealerHitsSoftSeventeen: true };
const standsSoft17: DealerConfig = { dealerHitsSoftSeventeen: false };

describe('dealerShouldHit', () => {
  it('must hit on a hard hand below 17, regardless of config', () => {
    const hand = [card('10'), card('6')]; // hard 16
    expect(dealerShouldHit(hand, hitsSoft17)).toBe(true);
    expect(dealerShouldHit(hand, standsSoft17)).toBe(true);
  });

  it('must stand on a hard 17, regardless of config', () => {
    const hand = [card('10'), card('7')]; // hard 17
    expect(dealerShouldHit(hand, hitsSoft17)).toBe(false);
    expect(dealerShouldHit(hand, standsSoft17)).toBe(false);
  });

  it('must hit on a soft 17 when dealerHitsSoftSeventeen is true', () => {
    const hand = [card('A'), card('6')]; // soft 17
    expect(dealerShouldHit(hand, hitsSoft17)).toBe(true);
  });

  it('must stand on a soft 17 when dealerHitsSoftSeventeen is false', () => {
    const hand = [card('A'), card('6')]; // soft 17
    expect(dealerShouldHit(hand, standsSoft17)).toBe(false);
  });

  it('must stand on a soft hand above 17, regardless of config — the exception is only at exactly 17', () => {
    const hand = [card('A'), card('8')]; // soft 19
    expect(dealerShouldHit(hand, hitsSoft17)).toBe(false);
    expect(dealerShouldHit(hand, standsSoft17)).toBe(false);
  });
});
