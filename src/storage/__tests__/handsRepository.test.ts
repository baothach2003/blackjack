import * as SQLite from 'expo-sqlite';
import { Database, migrate } from '../db';
import {
  getBiggestWin,
  getHandsPlayed,
  getLongestWinStreak,
  getNaturalBlackjackRate,
  getWinRate,
  HandData,
  insertHand,
} from '../handsRepository';
import { startSession } from '../sessionsRepository';

let db: Database;
let sessionId: number;

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync('test');
  await migrate(db);
  sessionId = (await startSession(db, 500)).id;
});

const hand = (overrides: Partial<HandData>): HandData => ({
  betAmount: 50,
  result: 'win',
  playerFinalScore: 20,
  dealerFinalScore: 18,
  inPlayAfter: 0,
  ...overrides,
});

describe('insertHand', () => {
  it('persists a hand row and returns it with its generated id/sessionId/playedAt', async () => {
    const result = await insertHand(db, sessionId, hand({ betAmount: 25, inPlayAfter: 525 }));

    expect(result.id).toBeGreaterThan(0);
    expect(result.sessionId).toBe(sessionId);
    expect(typeof result.playedAt).toBe('string');
    expect(result.betAmount).toBe(25);
    expect(result.inPlayAfter).toBe(525);

    expect(await getHandsPlayed(db)).toBe(1);
  });
});

describe('stat queries with no hands played', () => {
  it('all return 0 rather than throwing or returning null', async () => {
    expect(await getHandsPlayed(db)).toBe(0);
    expect(await getWinRate(db)).toBe(0);
    expect(await getNaturalBlackjackRate(db)).toBe(0);
    expect(await getBiggestWin(db)).toBe(0);
    expect(await getLongestWinStreak(db)).toBe(0);
  });
});

describe('stat queries against a hand-crafted set of hands', () => {
  // Session buy-in: 500.
  beforeEach(async () => {
    await insertHand(db, sessionId, hand({ betAmount: 50, result: 'win', inPlayAfter: 550 })); // +50
    await insertHand(db, sessionId, hand({ betAmount: 50, result: 'blackjack', inPlayAfter: 625 })); // +75
    await insertHand(db, sessionId, hand({ betAmount: 100, result: 'lose', inPlayAfter: 525 })); // -100
    await insertHand(db, sessionId, hand({ betAmount: 100, result: 'push', inPlayAfter: 525 })); // +0
    await insertHand(db, sessionId, hand({ betAmount: 60, result: 'win', inPlayAfter: 585 })); // +60
    await insertHand(db, sessionId, hand({ betAmount: 60, result: 'win', inPlayAfter: 645 })); // +60
    await insertHand(db, sessionId, hand({ betAmount: 60, result: 'win', inPlayAfter: 705 })); // +60
    await insertHand(db, sessionId, hand({ betAmount: 200, result: 'bust', inPlayAfter: 505 })); // -200
  });

  it('getHandsPlayed counts every hand', async () => {
    expect(await getHandsPlayed(db)).toBe(8);
  });

  it('getWinRate counts win + blackjack as wins, out of all hands', async () => {
    // 5 wins (win,blackjack,win,win,win) out of 8 hands
    expect(await getWinRate(db)).toBeCloseTo(5 / 8);
  });

  it('getNaturalBlackjackRate counts only blackjack results', async () => {
    expect(await getNaturalBlackjackRate(db)).toBeCloseTo(1 / 8);
  });

  it('getLongestWinStreak finds the longest run of consecutive wins', async () => {
    // streak of 2 (win, blackjack), broken by lose/push, then streak of 3 (win,win,win)
    expect(await getLongestWinStreak(db)).toBe(3);
  });

  it('getBiggestWin finds the largest single-hand In-Play increase among winning hands', async () => {
    // the blackjack hand won 75 (625 - 550), the largest of any winning hand
    expect(await getBiggestWin(db)).toBe(75);
  });
});
