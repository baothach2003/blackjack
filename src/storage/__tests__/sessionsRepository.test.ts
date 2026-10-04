import * as SQLite from 'expo-sqlite';
import { Database, INITIAL_BALANCE, migrate } from '../db';
import { endSession, getCurrentInPlay, startSession } from '../sessionsRepository';
import { getBalance } from '../walletRepository';

let db: Database;

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync('test');
  await migrate(db);
});

// Test-only helper: inserts a hand row directly, bypassing handsRepository
// (built in the next slice of this phase) since only in_play_after matters here.
async function insertRawHand(sessionId: number, inPlayAfter: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO hands
      (session_id, played_at, bet_amount, result, player_final_score, dealer_final_score, in_play_after)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, new Date().toISOString(), 10, 'win', 20, 18, inPlayAfter],
  );
}

describe('startSession', () => {
  it('creates a session row and debits Balance by the buy-in amount', async () => {
    const session = await startSession(db, 300);

    expect(session.buy_in_amount).toBe(300);
    expect(session.ended_at).toBeNull();
    expect(session.ending_in_play).toBeNull();
    expect(await getBalance(db)).toBe(INITIAL_BALANCE - 300);
  });
});

describe('getCurrentInPlay', () => {
  it('falls back to buy_in_amount when no hands have been played yet', async () => {
    const session = await startSession(db, 250);
    expect(await getCurrentInPlay(db, session.id)).toBe(250);
  });

  it('derives In-Play from the most recent hand once hands have been played', async () => {
    const session = await startSession(db, 250);

    await insertRawHand(session.id, 260);
    await insertRawHand(session.id, 240);
    await insertRawHand(session.id, 310);

    expect(await getCurrentInPlay(db, session.id)).toBe(310);
  });

  it('throws for a session that does not exist', async () => {
    await expect(getCurrentInPlay(db, 999)).rejects.toThrow();
  });
});

describe('endSession', () => {
  it('sets ended_at/ending_in_play and credits the remaining In-Play back to Balance', async () => {
    const session = await startSession(db, 300);
    await insertRawHand(session.id, 180);

    await endSession(db, session.id, 180);

    const row = await db.getFirstAsync<{ ended_at: string | null; ending_in_play: number | null }>(
      'SELECT ended_at, ending_in_play FROM sessions WHERE id = ?',
      [session.id],
    );
    expect(row?.ended_at).not.toBeNull();
    expect(row?.ending_in_play).toBe(180);
    expect(await getBalance(db)).toBe(INITIAL_BALANCE - 300 + 180);
  });
});

describe('full session simulation', () => {
  it('leaves Balance and In-Play consistent through start -> hands -> end', async () => {
    const startingBalance = await getBalance(db);

    const session = await startSession(db, 400);
    expect(await getBalance(db)).toBe(startingBalance - 400);
    expect(await getCurrentInPlay(db, session.id)).toBe(400);

    await insertRawHand(session.id, 390); // lost a small hand
    await insertRawHand(session.id, 420); // won one back
    await insertRawHand(session.id, 0); // busted out entirely

    expect(await getCurrentInPlay(db, session.id)).toBe(0);

    await endSession(db, session.id, 0);

    expect(await getBalance(db)).toBe(startingBalance - 400); // nothing left to credit back
  });
});
