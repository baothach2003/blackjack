import * as SQLite from 'expo-sqlite';
import { Database, INITIAL_BALANCE, migrate } from '../db';
import { creditFromLeaveTable, debitForBuyIn, getBalance, resetBalanceForTesting } from '../walletRepository';

let db: Database;

beforeEach(async () => {
  db = await SQLite.openDatabaseAsync('test');
  await migrate(db);
});

describe('getBalance', () => {
  it('returns the seeded starting Balance on a fresh wallet', async () => {
    expect(await getBalance(db)).toBe(INITIAL_BALANCE);
  });
});

describe('debitForBuyIn', () => {
  it('subtracts the buy-in amount from Balance and returns the new Balance', async () => {
    const newBalance = await debitForBuyIn(db, 200);
    expect(newBalance).toBe(INITIAL_BALANCE - 200);
    expect(await getBalance(db)).toBe(INITIAL_BALANCE - 200);
  });

  it('rejects a buy-in of zero or less', async () => {
    await expect(debitForBuyIn(db, 0)).rejects.toThrow();
    await expect(debitForBuyIn(db, -50)).rejects.toThrow();
  });

  it('rejects a buy-in larger than the current Balance', async () => {
    await expect(debitForBuyIn(db, INITIAL_BALANCE + 1)).rejects.toThrow();
    expect(await getBalance(db)).toBe(INITIAL_BALANCE); // unchanged
  });
});

describe('creditFromLeaveTable', () => {
  it('adds the remaining In-Play back onto Balance', async () => {
    await debitForBuyIn(db, 300);
    const newBalance = await creditFromLeaveTable(db, 120);
    expect(newBalance).toBe(INITIAL_BALANCE - 300 + 120);
    expect(await getBalance(db)).toBe(INITIAL_BALANCE - 300 + 120);
  });

  it('rejects a negative credit amount', async () => {
    await expect(creditFromLeaveTable(db, -1)).rejects.toThrow();
  });

  it('allows crediting zero (left the table with nothing in play)', async () => {
    await debitForBuyIn(db, 100);
    const newBalance = await creditFromLeaveTable(db, 0);
    expect(newBalance).toBe(INITIAL_BALANCE - 100);
  });
});

// DEV/QA-ONLY function — see the comment on resetBalanceForTesting itself.
describe('resetBalanceForTesting', () => {
  it('overwrites Balance directly, bypassing debit/credit validation entirely', async () => {
    const newBalance = await resetBalanceForTesting(db, 10000);
    expect(newBalance).toBe(10000);
    expect(await getBalance(db)).toBe(10000);
  });

  it('defaults to 10000 when called with no amount', async () => {
    const newBalance = await resetBalanceForTesting(db);
    expect(newBalance).toBe(10000);
    expect(await getBalance(db)).toBe(10000);
  });

  it('can set Balance to any value, including down or to zero — unlike debitForBuyIn/creditFromLeaveTable, no validation applies', async () => {
    await resetBalanceForTesting(db, 0);
    expect(await getBalance(db)).toBe(0);
  });
});
