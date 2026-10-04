import { INITIAL_BALANCE } from '../../storage/db';
import { getHandsPlayed } from '../../storage/handsRepository';
import { Card } from '../../game/types';
import { GameState, PlayerHandState } from '../../game/gameEngine';

// Regression tests for audit 2026-10-04 findings A1, A2, A5, A6 and R6
// (session S1): the money invariants of ADR-0003 and the timers of ADR-0005.

const card = (rank: Card['rank'], suit: Card['suit'] = 'Spades'): Card => ({ rank, suit });

const hand = (cards: Card[], bet: number, overrides: Partial<PlayerHandState> = {}): PlayerHandState => ({
  cards,
  bet,
  isDoubled: false,
  isStood: false,
  isBusted: false,
  ...overrides,
});

type GameStoreModule = typeof import('../gameStore');
type DbModule = typeof import('../../storage/db');
let store: GameStoreModule;
let getDatabase: DbModule['getDatabase'];

// Same isolation pattern as gameStore.test.ts: a fresh store and a fresh
// in-memory database per test.
function requireFreshStore(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-required per test after jest.resetModules()
  store = require('../gameStore') as GameStoreModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- re-required per test after jest.resetModules()
  getDatabase = (require('../../storage/db') as DbModule).getDatabase;
}

const state = () => store.useGameStore.getState();

// Deals the given games, in order, from gameEngine.startRound; everything
// else in the engine stays real.
function mockDeals(...deals: GameState[]): void {
  jest.doMock('../../game/gameEngine', () => {
    const actual = jest.requireActual('../../game/gameEngine');
    const startRound = jest.fn();
    for (const deal of deals) startRound.mockImplementationOnce(() => deal);
    return { ...actual, startRound };
  });
}

function dealt(playerHand: PlayerHandState, dealerHand: Card[], deck: Card[] = []): GameState {
  return { deck, dealerHand, playerHands: [playerHand], currentHandIndex: 0, roundPhase: 'playerTurn' };
}

function seatPlayerTurn(game: Omit<GameState, 'roundPhase'>): void {
  store.useGameStore.setState({ game: { ...game, roundPhase: 'playerTurn' }, screenPhase: 'playerTurn' });
}

// Runs an action and every timer it schedules (dealer pause, settlement
// writes, settlement auto-return), however long they turn out to be.
async function runToRest(action: () => Promise<void> | void): Promise<void> {
  const pending = action();
  await jest.advanceTimersByTimeAsync(10_000);
  await pending;
}

async function handRows(): Promise<{ session_id: number; result: string; in_play_after: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync('SELECT session_id, result, in_play_after FROM hands ORDER BY id');
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.dontMock('../../game/gameEngine');
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('A1: Double and Split only when In-Play covers every chip at risk', () => {
  it('audit A1 reproduction: double on a bet-all hand is unavailable and ignored, In-Play ends at 0, Leave succeeds', async () => {
    // Buy in 100, bet 100 on 6+5, dealer 10+8, next card 2.
    mockDeals(dealt(hand([card('6'), card('5')], 100), [card('10'), card('8')], [card('2')]));
    requireFreshStore();
    await state().startBuyIn(100);
    await runToRest(() => state().startRound(100));

    expect(state().canDouble).toBe(false); // 100 at risk + 100 extra > 100 In-Play

    await state().double();
    expect(state().playerHands[0].bet).toBe(100);
    expect(state().playerHands[0].cards).toHaveLength(2);
    expect(state().screenPhase).toBe('playerTurn');

    await runToRest(() => state().stand()); // 11 vs 18: loses 100
    expect(state().inPlay).toBe(0);
    expect(state().screenPhase).toBe('buyInSheet');

    await state().confirmLeaveTable();
    expect(state().session).toBeNull();
    expect(state().balance).toBe(INITIAL_BALANCE - 100);
  });

  it('allows double when In-Play covers the doubled bet exactly (bet 50 of 100)', async () => {
    mockDeals(dealt(hand([card('6'), card('5')], 50), [card('10'), card('8')], [card('9')]));
    requireFreshStore();
    await state().startBuyIn(100);
    await runToRest(() => state().startRound(50));

    expect(state().canDouble).toBe(true); // 50 + 50 = 100 <= 100

    await runToRest(() => state().double()); // 6+5+9 = 20 vs 18: wins 100
    expect(state().inPlay).toBe(200);
  });

  it('split on a bet-all pair is unavailable and ignored', async () => {
    mockDeals(dealt(hand([card('8'), card('8', 'Hearts')], 100), [card('10'), card('8')], [card('3'), card('2')]));
    requireFreshStore();
    await state().startBuyIn(100);
    await runToRest(() => state().startRound(100));

    expect(state().canSplit).toBe(false); // 100 + 100 > 100

    await state().split();
    expect(state().playerHands).toHaveLength(1);
    expect(state().playerHands[0].cards).toEqual([card('8'), card('8', 'Hearts')]);
  });

  it('audit A1 split variant: a split that In-Play cannot cover never happens, so two losses cannot go below 0', async () => {
    // S0 probe: In-Play 100, split 8s for 100 each, both lose -> -100.
    requireFreshStore();
    await state().startBuyIn(100);
    seatPlayerTurn({
      deck: [card('7'), card('5')],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('8'), card('8', 'Hearts')], 100)],
      currentHandIndex: 0,
    });

    await state().split(); // guarded inside the action, not only by the button
    expect(state().game?.playerHands).toHaveLength(1);

    await runToRest(() => state().stand()); // 16 vs 18: loses 100
    expect(state().inPlay).toBe(0);
  });

  it('after a split, double counts every hand already at risk: allowed on hand 1 (150 of 150), refused on hand 2 (200 > 150)', async () => {
    // pop order: hand A gets 3 (8+3 = 11), hand B gets 2 (8+2 = 10), hand A doubles into 9 (20).
    mockDeals(
      dealt(hand([card('8'), card('8', 'Hearts')], 50), [card('10'), card('8')], [card('9'), card('2'), card('3')]),
    );
    requireFreshStore();
    await state().startBuyIn(150);
    await runToRest(() => state().startRound(50));

    expect(state().canSplit).toBe(true); // 50 + 50 = 100 <= 150
    await state().split();
    jest.advanceTimersByTime(store.SPLIT_LOCKOUT_MS);
    expect(state().playerHands.map((h) => h.total)).toEqual([11, 10]);
    expect(state().canDouble).toBe(true); // 50 + 50 + 50 = 150 <= 150

    await runToRest(() => state().double()); // hand A: 20, bet 100, focus moves to hand B
    expect(state().currentHandIndex).toBe(1);
    expect(state().canDouble).toBe(false); // 100 + 50 + 50 = 200 > 150

    await state().double(); // ignored: unaffordable (the lockout is long over)
    expect(state().playerHands[1].bet).toBe(50);
    expect(state().screenPhase).toBe('playerTurn');

    // Hand A 20 vs 18 wins +100, hand B 10 vs 18 loses -50: 150 + 100 - 50 = 200.
    await runToRest(() => state().stand());
    expect(state().inPlay).toBe(200);
  });
});

describe('A1 invariant: In-Play never negative and Leave The Table always succeeds', () => {
  it('scripted session mixing bet-all, double and split (hand-computed totals)', async () => {
    // Each deck holds enough cards for the refused split/double to really
    // happen if a guard were missing, so the test cannot pass by an empty deck.
    mockDeals(
      // Round 1: bet-all 100 on a pair of 8s: neither split nor double affordable. 16 vs 18 loses.
      dealt(hand([card('8'), card('8', 'Hearts')], 100), [card('10'), card('8')], [card('4'), card('3'), card('2')]),
      // Round 2: In-Play 100 after re-buy, bet 50 on 6+5, double into 2: 13 vs 18 loses 100.
      dealt(hand([card('6'), card('5')], 50), [card('10'), card('8')], [card('2')]),
      // Round 3: In-Play 150 after re-buy, bet 50 on 8s, split (A: 8+3, B: 8+2), double A into 9;
      // the K is what a refused double on B would draw.
      dealt(
        hand([card('8'), card('8', 'Hearts')], 50),
        [card('10'), card('8')],
        [card('K'), card('9'), card('2'), card('3')],
      ),
    );
    requireFreshStore();
    const seen: number[] = [];
    const unsubscribe = store.useGameStore.subscribe((s) => {
      if (s.inPlay !== null) seen.push(s.inPlay);
    });

    await state().startBuyIn(100); // Balance 900
    await runToRest(() => state().startRound(100));
    await state().split();
    await state().double();
    await runToRest(() => state().stand());
    expect(state().inPlay).toBe(0);
    expect(state().screenPhase).toBe('buyInSheet');

    await state().rebuy(100); // Balance 800, In-Play 100
    jest.advanceTimersByTime(store.ACTION_LOCKOUT_MS); // the player sees the Place Bet Sheet
    await runToRest(() => state().startRound(50));
    await runToRest(() => state().double());
    expect(state().inPlay).toBe(0);

    await state().rebuy(150); // Balance 650, In-Play 150
    jest.advanceTimersByTime(store.ACTION_LOCKOUT_MS);
    await runToRest(() => state().startRound(50));
    await runToRest(() => state().split()); // runToRest also passes the hand-switch lockout
    await runToRest(() => state().double());
    await state().double(); // refused: 200 > 150
    await runToRest(() => state().stand()); // A wins 100, B loses 50: In-Play 200
    expect(state().inPlay).toBe(200);

    await state().confirmLeaveTable();
    unsubscribe();

    expect(state().session).toBeNull();
    expect(state().balance).toBe(INITIAL_BALANCE - 100 - 100 - 150 + 200); // 850
    expect(Math.min(...seen)).toBe(0);
  });

  it('seeded random play over 300 rounds: In-Play never negative, every hands row non-negative, every Leave succeeds and adds up', async () => {
    // Deterministic pseudo-random numbers (Park-Miller) for both the real
    // shuffle and the player's choices, so a failure always reproduces.
    let seed = 20261004;
    const rng = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    jest.spyOn(Math, 'random').mockImplementation(rng);
    requireFreshStore();

    const seen: number[] = [];
    const unsubscribe = store.useGameStore.subscribe((s) => {
      if (s.inPlay !== null) seen.push(s.inPlay);
    });

    // One sitting at the table: Balance before the Buy-in, chips bought in.
    let balanceBeforeSitting = INITIAL_BALANCE;
    let boughtIn = 0;
    let sessionsClosed = 0;
    const leaveAndCheck = async () => {
      const inPlayBeforeLeaving = state().inPlay ?? 0;
      await state().confirmLeaveTable();
      expect(state().session).toBeNull();
      expect(state().balance).toBe(balanceBeforeSitting - boughtIn + inPlayBeforeLeaving);
      sessionsClosed += 1;
    };
    const sitDown = async () => {
      if ((state().balance ?? 0) < 1) await state().resetBalanceForTesting(INITIAL_BALANCE);
      balanceBeforeSitting = state().balance ?? 0;
      boughtIn = Math.min(balanceBeforeSitting, 100 + Math.floor(rng() * 400));
      await state().startBuyIn(boughtIn);
    };

    await sitDown();
    let doubles = 0;
    let splits = 0;

    for (let round = 0; round < 300; round += 1) {
      if (state().screenPhase === 'buyInSheet') {
        const balance = state().balance ?? 0;
        if (balance < 1 || rng() < 0.3) {
          await leaveAndCheck();
          await sitDown();
        } else {
          const amount = Math.min(balance, 1 + Math.floor(rng() * 300));
          await state().rebuy(amount);
          jest.advanceTimersByTime(store.ACTION_LOCKOUT_MS);
          boughtIn += amount;
        }
      }
      const inPlay = state().inPlay ?? 0;
      const bet = rng() < 0.3 ? inPlay : 1 + Math.floor(rng() * inPlay);
      await runToRest(() => state().startRound(bet));
      if (state().screenPhase === 'insurance') state().takeInsurance(false);

      for (let step = 0; step < 40 && state().screenPhase === 'playerTurn'; step += 1) {
        const active = state().playerHands[state().currentHandIndex];
        if (state().canSplit && rng() < 0.5) {
          splits += 1;
          await runToRest(() => state().split());
        } else if (state().canDouble && rng() < 0.4) {
          doubles += 1;
          await runToRest(() => state().double());
        } else if (active.total < 17) {
          await runToRest(() => state().hit());
        } else {
          await runToRest(() => state().stand());
        }
      }
      expect(['betting', 'buyInSheet']).toContain(state().screenPhase);
    }

    await leaveAndCheck();
    unsubscribe();

    const rows = await handRows();
    expect(rows.length).toBeGreaterThan(300);
    expect(sessionsClosed).toBeGreaterThan(3);
    expect(doubles).toBeGreaterThan(10);
    expect(splits).toBeGreaterThan(3);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(Math.min(...rows.map((r) => r.in_play_after))).toBeGreaterThanOrEqual(0);
  });
});

describe('A2: the settlement auto-return never outlives its session', () => {
  it('audit A2 reproduction: leaving during the settlement pause stays idle after the pause', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('10'), card('9')], 50)],
      currentHandIndex: 0,
    });
    const pending = state().stand();
    jest.advanceTimersByTime(store.dealerTurnPauseMs(0));
    await pending;
    expect(state().screenPhase).toBe('settlement');

    await state().confirmLeaveTable();
    expect(state().screenPhase).toBe('idle');

    jest.advanceTimersByTime(store.SETTLEMENT_PAUSE_MS);
    expect(state().screenPhase).toBe('idle');
    expect(state().session).toBeNull();
  });

  it('a new session started inside the pause is not touched by the old timer', async () => {
    mockDeals(dealt(hand([card('10'), card('6')], 40), [card('10'), card('7')]));
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('10'), card('9')], 50)],
      currentHandIndex: 0,
    });
    const pending = state().stand();
    jest.advanceTimersByTime(store.dealerTurnPauseMs(0));
    await pending;

    await state().confirmLeaveTable();
    await state().startBuyIn(300);
    await state().startRound(40); // the new round, dealt inside the old pause
    expect(state().screenPhase).toBe('playerTurn');

    jest.advanceTimersByTime(store.SETTLEMENT_PAUSE_MS);
    expect(state().screenPhase).toBe('playerTurn');
    expect(state().game).not.toBeNull();
    expect(state().playerHands[0].bet).toBe(40);
  });
});

describe('A6: the dealer-turn pause never settles into another session', () => {
  it('leave during dealerTurn (forfeit, as today) then a quick new Buy-in: the old round never touches the new session', async () => {
    requireFreshStore();
    await state().startBuyIn(500); // Balance 500
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('7')],
      playerHands: [hand([card('10'), card('10')], 50)],
      currentHandIndex: 0,
    });
    const pending = state().stand(); // dealer-turn pause starts
    expect(state().screenPhase).toBe('dealerTurn');

    await state().confirmLeaveTable(); // forfeits 50 (R2 changes this in S2): Balance 500 + 450 = 950
    expect(state().balance).toBe(INITIAL_BALANCE - 50);

    await state().startBuyIn(200); // Balance 750, In-Play 200
    const newSessionId = state().session!.id;

    jest.advanceTimersByTime(store.dealerTurnPauseMs(0));
    await pending;
    jest.advanceTimersByTime(store.SETTLEMENT_PAUSE_MS);

    expect(state().inPlay).toBe(200);
    expect(state().screenPhase).toBe('betting');
    expect(state().balance).toBe(INITIAL_BALANCE - 50 - 200);
    const rows = await handRows();
    expect(rows).toEqual([{ session_id: newSessionId - 1, result: 'lose', in_play_after: 450 }]);
  });
});

describe('A5: a repeated or out-of-phase action is ignored', () => {
  it('two stand() calls 10 ms apart: one hands row, the win paid once', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('7')],
      playerHands: [hand([card('10'), card('9')], 50)],
      currentHandIndex: 0,
    });

    const first = state().stand();
    jest.advanceTimersByTime(10);
    const second = state().stand();
    await jest.advanceTimersByTimeAsync(10_000);
    await Promise.all([first, second]);

    const db = await getDatabase();
    expect(await getHandsPlayed(db)).toBe(1);
    expect(state().inPlay).toBe(550);
  });

  it('two confirmLeaveTable() calls at once mid-hand: one forfeit row, Balance credited once', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('K'), card('9')],
      playerHands: [hand([card('10'), card('7')], 80)],
      currentHandIndex: 0,
    });

    await Promise.all([state().confirmLeaveTable(), state().confirmLeaveTable()]);

    const db = await getDatabase();
    expect(await getHandsPlayed(db)).toBe(1);
    expect(state().balance).toBe(INITIAL_BALANCE - 500 + 420);
    expect(state().session).toBeNull();
  });

  it('two rebuy() calls at once: Balance debited once', async () => {
    requireFreshStore();
    await state().startBuyIn(50);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('9')],
      playerHands: [hand([card('10'), card('6')], 50)],
      currentHandIndex: 0,
    });
    await runToRest(() => state().stand()); // loses 50: In-Play 0, Buy-in Sheet
    expect(state().screenPhase).toBe('buyInSheet');

    await Promise.all([state().rebuy(200), state().rebuy(200)]);

    expect(state().inPlay).toBe(200);
    expect(state().balance).toBe(INITIAL_BALANCE - 50 - 200);
  });

  it('two rebuy() calls 10 ms apart: Balance debited once, In-Play matches', async () => {
    requireFreshStore();
    await state().startBuyIn(50);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('9')],
      playerHands: [hand([card('10'), card('6')], 50)],
      currentHandIndex: 0,
    });
    await runToRest(() => state().stand()); // In-Play 0, Buy-in Sheet

    const first = state().rebuy(200);
    await jest.advanceTimersByTimeAsync(10);
    const second = state().rebuy(200);
    await Promise.all([first, second]);

    expect(state().inPlay).toBe(200);
    expect(state().balance).toBe(INITIAL_BALANCE - 50 - 200);
  });

  it('rebuy() is ignored outside the Buy-in Sheet', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    expect(state().screenPhase).toBe('betting');

    await state().rebuy(200);

    expect(state().inPlay).toBe(500);
    expect(state().balance).toBe(INITIAL_BALANCE - 500);
  });

  it('hit, stand, double and split are ignored during the dealer turn', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [card('5'), card('5')],
      dealerHand: [card('10'), card('7')],
      playerHands: [hand([card('9'), card('9', 'Hearts')], 50)],
      currentHandIndex: 0,
    });
    const pending = state().stand();
    expect(state().screenPhase).toBe('dealerTurn');

    await state().hit();
    await state().double();
    await state().split();
    expect(state().playerHands).toHaveLength(1);
    expect(state().playerHands[0].cards).toHaveLength(2);
    expect(state().playerHands[0].bet).toBe(50);

    jest.advanceTimersByTime(store.dealerTurnPauseMs(0));
    await pending;
    expect(state().inPlay).toBe(550); // 18 vs 17, paid once
  });

  it('a second startRound() while a hand is in play is ignored', async () => {
    mockDeals(
      dealt(hand([card('10'), card('6')], 50), [card('10'), card('7')]),
      dealt(hand([card('9'), card('9')], 70), [card('10'), card('7')]),
    );
    requireFreshStore();
    await state().startBuyIn(500);
    await state().startRound(50);
    await state().startRound(70);

    expect(state().playerHands[0].bet).toBe(50);
    expect(state().playerHands[0].cards).toEqual([card('10'), card('6')]);
  });
});

describe('A5, found by the S1 doubt review: taps that land on a hand or phase the player has not seen', () => {
  // Split 8s for 100 each with In-Play 400: hand A 8+3 = 11, hand B 8+2 = 10.
  function seatSplitPair(): void {
    seatPlayerTurn({
      deck: [card('9'), card('9'), card('2'), card('3')],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('8'), card('8', 'Hearts')], 100)],
      currentHandIndex: 0,
    });
  }

  it('a second Double right after hand 1 finishes does not double hand 2 (hand-switch lockout)', async () => {
    requireFreshStore();
    await state().startBuyIn(400);
    seatSplitPair();
    await state().split();
    jest.advanceTimersByTime(store.SPLIT_LOCKOUT_MS);

    await state().double(); // hand A doubled and stood, focus moves to hand B
    jest.advanceTimersByTime(10);
    await state().double(); // the double tap: hand B still undoubled

    expect(state().currentHandIndex).toBe(1);
    expect(state().game?.playerHands.map((h) => h.bet)).toEqual([200, 100]);
    expect(state().screenPhase).toBe('playerTurn');
  });

  it('a second Stand right after hand 1 finishes does not stand hand 2', async () => {
    requireFreshStore();
    await state().startBuyIn(400);
    seatSplitPair();
    await state().split();
    jest.advanceTimersByTime(store.SPLIT_LOCKOUT_MS);

    await state().stand();
    jest.advanceTimersByTime(10);
    await state().stand();

    expect(state().screenPhase).toBe('playerTurn');
    expect(state().game?.playerHands[1].isStood).toBe(false);
  });

  it('after the lockout the next hand can be played normally', async () => {
    requireFreshStore();
    await state().startBuyIn(400);
    seatSplitPair();
    await state().split();
    jest.advanceTimersByTime(store.SPLIT_LOCKOUT_MS);
    await state().stand();
    jest.advanceTimersByTime(store.ACTION_LOCKOUT_MS);

    await runToRest(() => state().double()); // hand B 8+2+9 = 19 vs 18, bet 200
    // Hand A 11 vs 18 loses 100, hand B wins 200: 400 - 100 + 200 = 500.
    expect(state().inPlay).toBe(500);
  });

  it('a second Split right after a split does not re-split the new hand unseen', async () => {
    requireFreshStore();
    await state().startBuyIn(400);
    seatPlayerTurn({
      // hand A becomes 8+8 again; 4 and 3 are what an unseen re-split would draw
      deck: [card('5'), card('4'), card('3'), card('2'), card('8', 'Clubs')],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('8'), card('8', 'Hearts')], 100)],
      currentHandIndex: 0,
    });

    await state().split();
    jest.advanceTimersByTime(10);
    await state().split();

    expect(state().game?.playerHands).toHaveLength(2);
  });

  it('cancelBet, openPlaceBetSheet and takeInsurance only act in their own phase', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('7')],
      playerHands: [hand([card('10'), card('6')], 50)],
      currentHandIndex: 0,
    });

    state().cancelBet();
    expect(state().screenPhase).toBe('playerTurn');
    state().openPlaceBetSheet();
    expect(state().screenPhase).toBe('playerTurn');

    store.useGameStore.setState({ game: null, screenPhase: 'betting' });
    state().takeInsurance(false);
    expect(state().screenPhase).toBe('betting');
  });

  it('leaveTable mid-hand forfeits the open hand like confirmLeaveTable', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('K'), card('9')],
      playerHands: [hand([card('10'), card('7')], 80)],
      currentHandIndex: 0,
    });

    await state().leaveTable();

    expect(await handRows()).toEqual([{ session_id: 1, result: 'lose', in_play_after: 420 }]);
    expect(state().balance).toBe(INITIAL_BALANCE - 500 + 420);
  });

  it('canDouble and canSplit are false once the player is no longer to act', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('7')],
      playerHands: [hand([card('9'), card('9', 'Hearts')], 50)],
      currentHandIndex: 0,
    });
    const pending = state().stand();

    expect(state().screenPhase).toBe('dealerTurn');
    expect(state().canDouble).toBe(false);
    expect(state().canSplit).toBe(false);

    jest.advanceTimersByTime(store.dealerTurnPauseMs(0));
    await pending;
    expect(state().canDouble).toBe(false);
    expect(state().canSplit).toBe(false);
  });
});

describe('A9 lockout extended by the second S1 doubt review: a tap landing on buttons that just replaced others', () => {
  it('a double tap on "Insurance No" does not land on Double', async () => {
    mockDeals(dealt(hand([card('6'), card('5')], 50), [card('A'), card('7')], [card('9')]));
    requireFreshStore();
    await state().startBuyIn(500);
    await state().startRound(50);
    jest.advanceTimersByTime(store.DEAL_LOCKOUT_MS);
    expect(state().screenPhase).toBe('insurance');

    state().takeInsurance(false);
    expect(state().screenPhase).toBe('playerTurn');
    jest.advanceTimersByTime(100);
    await state().double();

    expect(state().game?.playerHands[0].bet).toBe(50);
    expect(state().game?.playerHands[0].cards).toHaveLength(2);
  });

  it('a tap right after the deal does not act on the hand being dealt', async () => {
    mockDeals(dealt(hand([card('6'), card('5')], 50), [card('10'), card('7')], [card('9')]));
    requireFreshStore();
    await state().startBuyIn(500);
    await state().startRound(50);
    jest.advanceTimersByTime(100);

    await state().double();
    expect(state().game?.playerHands[0].bet).toBe(50);

    jest.advanceTimersByTime(store.DEAL_LOCKOUT_MS);
    await runToRest(() => state().double()); // now seen: 6+5+9 = 20 vs 17, wins 100
    expect(state().inPlay).toBe(600);
  });

  it('a double tap on the Buy-in Sheet\'s "Buy-in" does not deal from the Place Bet Sheet that replaces it', async () => {
    mockDeals(dealt(hand([card('10'), card('6')], 1), [card('10'), card('7')]));
    requireFreshStore();
    await state().startBuyIn(50);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('9')],
      playerHands: [hand([card('10'), card('6')], 50)],
      currentHandIndex: 0,
    });
    await runToRest(() => state().stand()); // In-Play 0, Buy-in Sheet

    await state().rebuy(200);
    jest.advanceTimersByTime(100);
    await state().startRound(1);

    expect(state().screenPhase).toBe('betting');
    expect(state().game).toBeNull();
  });

  it('the lockout runs on a monotonic clock: setting the wall clock back does not freeze play', async () => {
    requireFreshStore();
    await state().startBuyIn(400);
    seatPlayerTurn({
      deck: [card('9'), card('9'), card('2'), card('3')],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('8'), card('8', 'Hearts')], 100)],
      currentHandIndex: 0,
    });
    await state().split();
    jest.advanceTimersByTime(store.SPLIT_LOCKOUT_MS);
    jest.setSystemTime(Date.now() - 60_000); // the device clock steps back a minute

    await state().stand();

    expect(state().currentHandIndex).toBe(1);
  });
});

describe('lockout lengths decided by Thach in S1 after the third doubt review: until the cards land', () => {
  it('lockout lengths follow the deal animation: 4 cards 750 ms, a split 450 ms, a hit 300 ms', () => {
    requireFreshStore();
    // tokens: stagger 150 ms, slide 300 ms; the last card lands at (n - 1) * 150 + 300.
    expect(store.DEAL_LOCKOUT_MS).toBe(750);
    expect(store.SPLIT_LOCKOUT_MS).toBe(450);
    expect(store.HIT_LOCKOUT_MS).toBe(300);
  });

  it('after the deal, actions stay ignored until the dealer\'s hole card has landed (750 ms)', async () => {
    mockDeals(dealt(hand([card('6'), card('5')], 50), [card('10'), card('7')], [card('9')]));
    requireFreshStore();
    await state().startBuyIn(500);
    await state().startRound(50);

    jest.advanceTimersByTime(600); // the player's 2nd card has just landed, the hole card has not
    await state().double();
    expect(state().game?.playerHands[0].bet).toBe(50);

    jest.advanceTimersByTime(150);
    await runToRest(() => state().double()); // 750 ms: 6+5+9 = 20 vs 17, wins 100
    expect(state().inPlay).toBe(600);
  });

  it('Insurance Yes/No is ignored while the deal is still landing', async () => {
    mockDeals(dealt(hand([card('6'), card('5')], 50), [card('A'), card('7')]));
    requireFreshStore();
    await state().startBuyIn(500);
    await state().startRound(50);

    jest.advanceTimersByTime(100);
    state().takeInsurance(false);
    expect(state().screenPhase).toBe('insurance');
  });

  it('a double tap on Hit draws one card; the next hit is accepted once that card has landed', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [card('2'), card('3'), card('4')],
      dealerHand: [card('10'), card('7')],
      playerHands: [hand([card('10'), card('2')], 50)],
      currentHandIndex: 0,
    });

    await state().hit(); // draws 4: 16
    jest.advanceTimersByTime(10);
    await state().hit(); // the double tap: ignored
    expect(state().game?.playerHands[0].cards).toHaveLength(3);

    jest.advanceTimersByTime(store.HIT_LOCKOUT_MS);
    await state().hit(); // draws 3: 19
    expect(state().game?.playerHands[0].cards).toHaveLength(4);
  });

  it('after a split, actions stay ignored until both new cards have landed (450 ms)', async () => {
    requireFreshStore();
    await state().startBuyIn(400);
    seatPlayerTurn({
      deck: [card('9'), card('9'), card('2'), card('3')],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('8'), card('8', 'Hearts')], 100)],
      currentHandIndex: 0,
    });
    await state().split();

    jest.advanceTimersByTime(300);
    await state().stand();
    expect(state().currentHandIndex).toBe(0);

    jest.advanceTimersByTime(150);
    await state().stand();
    expect(state().currentHandIndex).toBe(1);
  });

  it('the settlement auto-return locks the Place Bet Sheet that appears', async () => {
    mockDeals(dealt(hand([card('10'), card('6')], 50), [card('10'), card('7')]));
    requireFreshStore();
    await state().startBuyIn(500);
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('7')],
      playerHands: [hand([card('10'), card('9')], 50)],
      currentHandIndex: 0,
    });
    const pending = state().stand();
    jest.advanceTimersByTime(store.dealerTurnPauseMs(0));
    await pending;
    jest.advanceTimersByTime(store.SETTLEMENT_PAUSE_MS); // back to the Place Bet Sheet
    expect(state().screenPhase).toBe('betting');

    await state().startRound(50);
    state().cancelBet();
    expect(state().game).toBeNull();
    expect(state().screenPhase).toBe('betting');
  });

  it('the waiting bar and the Place Bet Sheet lock each other', async () => {
    mockDeals(dealt(hand([card('10'), card('6')], 50), [card('10'), card('7')]));
    requireFreshStore();
    await state().startBuyIn(500);

    state().cancelBet(); // to the waiting bar
    jest.advanceTimersByTime(100);
    state().openPlaceBetSheet(); // the double tap on Cancel lands on the bar: ignored
    expect(state().screenPhase).toBe('waiting');

    jest.advanceTimersByTime(store.ACTION_LOCKOUT_MS);
    state().openPlaceBetSheet();
    jest.advanceTimersByTime(100);
    await state().startRound(50); // the double tap on the bar lands on Place Bet: ignored
    expect(state().game).toBeNull();
  });

  it('a clock that jumps (fake timers re-installed) never leaves the lockout stuck', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    jest.advanceTimersByTime(60_000);
    state().cancelBet(); // locks at t = 60 s

    jest.useFakeTimers(); // the clock restarts at 0
    jest.advanceTimersByTime(store.ACTION_LOCKOUT_MS);
    state().openPlaceBetSheet();

    expect(state().screenPhase).toBe('betting');
  });

  it('a hand switch is detected against the game itself, not a stale copied index', async () => {
    requireFreshStore();
    await state().startBuyIn(400);
    store.useGameStore.setState({ currentHandIndex: 1 }); // stale view field from an earlier round
    seatPlayerTurn({
      deck: [],
      dealerHand: [card('10'), card('8')],
      playerHands: [hand([card('8'), card('3')], 100), hand([card('8', 'Hearts'), card('2')], 100)],
      currentHandIndex: 0,
    });

    await state().stand(); // hand 0 -> hand 1
    jest.advanceTimersByTime(10);
    await state().stand(); // the double tap: ignored

    expect(state().screenPhase).toBe('playerTurn');
  });
});

describe('A3 store side, decided by Thach in S1: one open session at a time', () => {
  it('two startBuyIn() calls from a double tap open one session and debit Balance once', async () => {
    requireFreshStore();

    await Promise.all([state().startBuyIn(300), state().startBuyIn(300)]);

    const db = await getDatabase();
    const sessions = await db.getAllAsync<{ id: number }>('SELECT id FROM sessions');
    expect(sessions).toHaveLength(1);
    expect(state().balance).toBe(INITIAL_BALANCE - 300);
    expect(state().inPlay).toBe(300);
  });

  it('startBuyIn while a session is open changes nothing (the open table is kept)', async () => {
    requireFreshStore();
    await state().startBuyIn(500);
    const sessionId = state().session!.id;
    store.useGameStore.setState({ inPlay: 450 });

    await state().startBuyIn(300);

    expect(state().session!.id).toBe(sessionId);
    expect(state().inPlay).toBe(450);
    expect(state().balance).toBe(INITIAL_BALANCE - 500);
  });
});

describe('R6: startRound rejects a bet below 1 or above In-Play', () => {
  it.each([0, -10, 501, 1.5])('rejects a bet of %p with In-Play 500: no hand is dealt', async (bet) => {
    mockDeals(dealt(hand([card('10'), card('6')], bet), [card('10'), card('7')]));
    requireFreshStore();
    await state().startBuyIn(500);

    await state().startRound(bet);

    expect(state().game).toBeNull();
    expect(state().screenPhase).toBe('betting');
    expect(state().error).not.toBeNull();
  });

  it('accepts a bet of exactly In-Play (bet-all) and of exactly 1', async () => {
    mockDeals(
      dealt(hand([card('10'), card('6')], 500), [card('10'), card('7')]),
      dealt(hand([card('10'), card('6')], 1), [card('10'), card('7')]),
    );
    requireFreshStore();
    await state().startBuyIn(500);

    await state().startRound(500);
    expect(state().playerHands[0].bet).toBe(500);

    jest.advanceTimersByTime(store.DEAL_LOCKOUT_MS);
    await runToRest(() => state().stand()); // 16 vs 17: In-Play 0, Buy-in Sheet
    await state().rebuy(10);
    jest.advanceTimersByTime(store.ACTION_LOCKOUT_MS);
    await state().startRound(1);
    expect(state().playerHands[0].bet).toBe(1);
    expect(state().error).toBeNull();
  });
});
