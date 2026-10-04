// Manual Jest mock for expo-sqlite: expo-sqlite wraps a native module and
// cannot run inside plain Jest/Node, so tests need a functional stand-in. This
// backs the same async API surface (execAsync/runAsync/getFirstAsync/
// getAllAsync) with better-sqlite3, a real (synchronous) SQLite engine that
// runs fine under Node — so repository tests exercise real SQL, not a dummy
// mock, per Jest's node_modules manual-mock convention (auto-used, no
// jest.mock('expo-sqlite') call needed).
import Database from 'better-sqlite3';

type BindParams = unknown[];

class MockSQLiteDatabase {
  private readonly nativeDb: Database.Database;

  constructor() {
    this.nativeDb = new Database(':memory:');
  }

  async execAsync(source: string): Promise<void> {
    this.nativeDb.exec(source);
  }

  async runAsync(source: string, params: BindParams = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const info = this.nativeDb.prepare(source).run(...params);
    return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
  }

  async getFirstAsync<T>(source: string, params: BindParams = []): Promise<T | null> {
    const row = this.nativeDb.prepare(source).get(...params);
    return (row as T) ?? null;
  }

  async getAllAsync<T>(source: string, params: BindParams = []): Promise<T[]> {
    return this.nativeDb.prepare(source).all(...params) as T[];
  }

  async closeAsync(): Promise<void> {
    this.nativeDb.close();
  }
}

export type SQLiteDatabase = MockSQLiteDatabase;

// Every call opens a fresh, isolated in-memory database — tests get isolation
// "for free" by just calling this again, without needing a shared singleton
// or manual reset step.
export async function openDatabaseAsync(): Promise<SQLiteDatabase> {
  return new MockSQLiteDatabase();
}
