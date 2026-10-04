import * as SQLite from 'expo-sqlite';

export type Database = SQLite.SQLiteDatabase;

// Starting Balance for a brand-new wallet. Not specified anywhere in the docs —
// blackjack-app-spec.md section 6 only gives illustrative example values
// ("1,240", "81,478"), never a confirmed starting amount for a fresh install.
// Flagging this as a placeholder pending a product decision, same treatment as
// DEALER_CONFIG in gameEngine.ts — easy to find and change here.
export const INITIAL_BALANCE = 1000;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS wallet (
    id INTEGER PRIMARY KEY NOT NULL,
    balance INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    started_at TEXT NOT NULL,
    buy_in_amount INTEGER NOT NULL,
    ended_at TEXT,
    ending_in_play INTEGER
  );

  CREATE TABLE IF NOT EXISTS hands (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    session_id INTEGER NOT NULL REFERENCES sessions(id),
    played_at TEXT NOT NULL,
    bet_amount INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('win', 'lose', 'push', 'blackjack', 'bust')),
    player_final_score INTEGER NOT NULL,
    dealer_final_score INTEGER NOT NULL,
    in_play_after INTEGER NOT NULL
  );
`;

// Idempotent: safe to call every time the app opens the database. Creates the
// three tables from CLAUDE.md section 3.2 if they don't exist yet, and seeds
// the singleton wallet row (id=1) on first run only.
export async function migrate(db: Database): Promise<void> {
  await db.execAsync(SCHEMA);

  const wallet = await db.getFirstAsync<{ id: number }>('SELECT id FROM wallet WHERE id = 1');
  if (!wallet) {
    await db.runAsync('INSERT INTO wallet (id, balance) VALUES (1, ?)', [INITIAL_BALANCE]);
  }
}

let dbPromise: Promise<Database> | null = null;

// Singleton used by the app at runtime (wired up later from gameStore.ts).
// Repositories don't call this themselves — every repository function takes a
// `db` handle as an explicit parameter, so they stay trivial to unit test
// against an isolated in-memory database instead of this shared instance.
export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('blackjack.db').then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
