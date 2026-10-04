import { Database } from './db';

// Matches CLAUDE.md section 3.2's hands.result CHECK constraint. Wider than
// gameEngine.ts's Outcome ('win'|'lose'|'push'|'blackjack') on purpose: 'bust'
// is a distinct stored result (per blackjack-app-spec.md's Result overlay
// states) even though resolveOutcome folds a bust into 'lose' — deciding
// which of the two to write is the caller's job (gameStore.ts, later), not
// this repository's.
export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'bust';

export interface HandData {
  betAmount: number;
  result: HandResult;
  playerFinalScore: number;
  dealerFinalScore: number;
  inPlayAfter: number;
}

export interface Hand extends HandData {
  id: number;
  sessionId: number;
  playedAt: string;
}

const WINNING_RESULTS: HandResult[] = ['win', 'blackjack'];

export async function insertHand(db: Database, sessionId: number, hand: HandData): Promise<Hand> {
  const playedAt = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO hands
      (session_id, played_at, bet_amount, result, player_final_score, dealer_final_score, in_play_after)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      playedAt,
      hand.betAmount,
      hand.result,
      hand.playerFinalScore,
      hand.dealerFinalScore,
      hand.inPlayAfter,
    ],
  );

  return { id: result.lastInsertRowId, sessionId, playedAt, ...hand };
}

export async function getHandsPlayed(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM hands');
  return row?.count ?? 0;
}

export async function getWinRate(db: Database): Promise<number> {
  const total = await getHandsPlayed(db);
  if (total === 0) return 0;

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM hands WHERE result IN ('win', 'blackjack')",
  );
  return (row?.count ?? 0) / total;
}

export async function getNaturalBlackjackRate(db: Database): Promise<number> {
  const total = await getHandsPlayed(db);
  if (total === 0) return 0;

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM hands WHERE result = 'blackjack'",
  );
  return (row?.count ?? 0) / total;
}

// ProfileScreen's "Blackjacks Hit" stat (blackjack-app-spec.md section 3.11)
// is a raw count, not a rate — CLAUDE.md section 7's summary table lists
// "natural blackjack rate," but the actual screen description and mockup
// both show a plain count ("24"). Adding this alongside getNaturalBlackjackRate
// rather than replacing it, since CLAUDE.md still names the rate as a stat.
export async function getNaturalBlackjackCount(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM hands WHERE result = 'blackjack'",
  );
  return row?.count ?? 0;
}

// "Biggest Win" (blackjack-app-spec.md section 3.11) is the largest amount
// actually won on a single hand. There's no stored payout/win-amount column
// (CLAUDE.md's schema doesn't have one, and the exact blackjack payout ratio
// is itself an unconfirmed open question per blackjack-app-spec.md section 6)
// — so it's derived as each winning hand's in-play delta: in_play_after minus
// what In-Play was immediately before that hand, using the session's
// buy_in_amount as the "before" value for a session's first hand. This stays
// correct regardless of whatever payout ratio ends up decided, since it reads
// the actual observed change rather than assuming one.
export async function getBiggestWin(db: Database): Promise<number> {
  const rows = await db.getAllAsync<{
    id: number;
    session_id: number;
    buy_in_amount: number;
    in_play_after: number;
    result: HandResult;
  }>(
    `SELECT h.id, h.session_id, s.buy_in_amount, h.in_play_after, h.result
     FROM hands h
     JOIN sessions s ON s.id = h.session_id
     ORDER BY h.session_id ASC, h.id ASC`,
  );

  let biggest = 0;
  const lastInPlayBySession = new Map<number, number>();

  for (const row of rows) {
    const before = lastInPlayBySession.get(row.session_id) ?? row.buy_in_amount;
    const change = row.in_play_after - before;

    if (WINNING_RESULTS.includes(row.result) && change > biggest) {
      biggest = change;
    }

    lastInPlayBySession.set(row.session_id, row.in_play_after);
  }

  return biggest;
}

export async function getLongestWinStreak(db: Database): Promise<number> {
  const rows = await db.getAllAsync<{ result: HandResult }>('SELECT result FROM hands ORDER BY id ASC');

  let longest = 0;
  let current = 0;

  for (const row of rows) {
    if (WINNING_RESULTS.includes(row.result)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}
