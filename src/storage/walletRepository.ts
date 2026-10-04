import { Database } from './db';

export async function getBalance(db: Database): Promise<number> {
  const row = await db.getFirstAsync<{ balance: number }>('SELECT balance FROM wallet WHERE id = 1');
  if (!row) {
    throw new Error('Wallet row is missing — did you forget to run migrate()?');
  }
  return row.balance;
}

// Buy-in: the only operation allowed to debit Balance. Called from
// sessionsRepository.startSession — never call this directly from a screen.
export async function debitForBuyIn(db: Database, amount: number): Promise<number> {
  if (amount <= 0) {
    throw new Error('Buy-in amount must be positive');
  }

  const currentBalance = await getBalance(db);
  if (amount > currentBalance) {
    throw new Error('Buy-in amount exceeds current Balance');
  }

  const newBalance = currentBalance - amount;
  await db.runAsync('UPDATE wallet SET balance = ? WHERE id = 1', [newBalance]);
  return newBalance;
}

// Leave The Table: the only operation allowed to credit Balance. Called from
// sessionsRepository.endSession — never call this directly from a screen.
export async function creditFromLeaveTable(db: Database, amount: number): Promise<number> {
  if (amount < 0) {
    throw new Error('Credited amount cannot be negative');
  }

  const currentBalance = await getBalance(db);
  const newBalance = currentBalance + amount;
  await db.runAsync('UPDATE wallet SET balance = ? WHERE id = 1', [newBalance]);
  return newBalance;
}

// DEV/QA-ONLY. Every other write in this file goes through debitForBuyIn or
// creditFromLeaveTable specifically so Balance changes stay traceable
// (CLAUDE.md section 9: never conflate Balance and In-Play, never touch
// Balance from an untraceable generic setter). This function deliberately
// breaks that rule — it exists only so manual device testing doesn't burn
// through the 1,000-chip starting Balance and require reinstalling the app.
// It must never be reachable from a real gameplay action. Remove or gate this
// behind a dev-build flag before Phase 8 (packaging) — don't let it quietly
// become a real feature.
export async function resetBalanceForTesting(db: Database, amount: number = 10000): Promise<number> {
  await db.runAsync('UPDATE wallet SET balance = ? WHERE id = 1', [amount]);
  return amount;
}
