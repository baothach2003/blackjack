import { Database } from './db';
import { creditFromLeaveTable, debitForBuyIn } from './walletRepository';

export interface Session {
  id: number;
  started_at: string;
  buy_in_amount: number;
  ended_at: string | null;
  ending_in_play: number | null;
}

// Buy-in: debits Balance, opens a new session row.
export async function startSession(db: Database, buyInAmount: number): Promise<Session> {
  await debitForBuyIn(db, buyInAmount);

  const startedAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO sessions (started_at, buy_in_amount, ended_at, ending_in_play) VALUES (?, ?, NULL, NULL)',
    [startedAt, buyInAmount],
  );

  return {
    id: result.lastInsertRowId,
    started_at: startedAt,
    buy_in_amount: buyInAmount,
    ended_at: null,
    ending_in_play: null,
  };
}

// In-Play is never stored as its own mutated column — it's derived from the
// most recent hand's in_play_after, falling back to the session's
// buy_in_amount when no hands have been played yet.
export async function getCurrentInPlay(db: Database, sessionId: number): Promise<number> {
  const lastHand = await db.getFirstAsync<{ in_play_after: number }>(
    'SELECT in_play_after FROM hands WHERE session_id = ? ORDER BY id DESC LIMIT 1',
    [sessionId],
  );
  if (lastHand) {
    return lastHand.in_play_after;
  }

  const session = await db.getFirstAsync<{ buy_in_amount: number }>(
    'SELECT buy_in_amount FROM sessions WHERE id = ?',
    [sessionId],
  );
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  return session.buy_in_amount;
}

// Leave The Table: closes the session and credits the remaining In-Play back
// onto Balance.
export async function endSession(db: Database, sessionId: number, remainingInPlay: number): Promise<void> {
  const endedAt = new Date().toISOString();
  await db.runAsync('UPDATE sessions SET ended_at = ?, ending_in_play = ? WHERE id = ?', [
    endedAt,
    remainingInPlay,
    sessionId,
  ]);
  await creditFromLeaveTable(db, remainingInPlay);
}
