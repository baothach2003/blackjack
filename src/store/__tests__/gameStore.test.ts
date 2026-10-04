import { INITIAL_BALANCE } from '../../storage/db';
import { getHandsPlayed } from '../../storage/handsRepository';
import { Card } from '../../game/types';
import { GameState } from '../../game/gameEngine';

const card = (rank: Card['rank'], suit: Card['suit'] = 'Spades'): Card => ({ rank, suit });

// db.ts's getDatabase() memoizes a module-level singleton, and gameStore.ts
// creates its Zustand store at module load time — both need to be fresh per
// test for isolation (separate in-memory wallet/hands data, separate store
// state), so every test re-imports the store after jest.resetModules().
type GameStoreModule = typeof import('../gameStore');
type DbModule = typeof import('../../storage/db');
let useGameStore: GameStoreModule['useGameStore'];
let DEALER_TURN_DISPLAY_MS: GameStoreModule['DEALER_TURN_DISPLAY_MS'];
let dealerTurnPauseMs: GameStoreModule['dealerTurnPauseMs'];
let SETTLEMENT_PAUSE_MS: GameStoreModule['SETTLEMENT_PAUSE_MS'];
let getDatabase: DbModule['getDatabase'];

function requireFreshStore(): void {
  // Dynamic re-require is what makes jest.resetModules() actually isolate the
  // store's module-level state (Zustand's create() and db.ts's cached
  // connection) between tests; a static import wouldn't be re-evaluated per test.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('../gameStore') as GameStoreModule;
  useGameStore = module.useGameStore;
  DEALER_TURN_DISPLAY_MS = module.DEALER_TURN_DISPLAY_MS;
  dealerTurnPauseMs = module.dealerTurnPauseMs;
  SETTLEMENT_PAUSE_MS = module.SETTLEMENT_PAUSE_MS;
  // Same registry generation as the require above, so this resolves to the
  // exact db.ts instance (and its cached connection) gameStore.ts itself uses.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  getDatabase = (require('../../storage/db') as DbModule).getDatabase;
}

// extraCardsDrawn must match how many cards the dealer actually hits in the
// scenario under test — the pause is no longer a fixed constant, so
// advancing by the wrong amount would either settle too early (assertions
// below would catch that) or never settle at all (the awaited promise would
// hang and the test would time out).
async function settleAndFlush(pending: Promise<void>, extraCardsDrawn: number): Promise<void> {
  jest.advanceTimersByTime(dealerTurnPauseMs(extraCardsDrawn));
  await pending;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.dontMock('../../game/gameEngine');
  jest.resetModules();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('dealer-turn sequencing (bug fix: Result overlay appearing before the dealer reveal)', () => {
  beforeEach(() => {
    requireFreshStore();
  });

  it('stand: commits a distinct dealerTurn state — with the dealer already fully revealed/played — strictly before settlement', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('8'), card('9')], // 17, already stands — no hit needed
      playerHands: [{ cards: [card('10'), card('9')], bet: 50, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, screenPhase: 'playerTurn' });

    const pending = useGameStore.getState().stand();

    // Synchronously, before any timer/microtask runs: dealerTurn must already
    // be committed, with the dealer's hand fully revealed.
    const mid = useGameStore.getState();
    expect(mid.screenPhase).toBe('dealerTurn');
    expect(mid.dealer?.holeRevealed).toBe(true);
    expect(mid.dealer?.cards).toEqual([card('8'), card('9')]);
    expect(mid.dealer?.visibleTotal).toBe(17);
    // Not settled yet — this is the exact bug: settlement must not be visible yet.
    expect(mid.resultQueue).toEqual([]);

    await settleAndFlush(pending, 0); // no hit needed

    const final = useGameStore.getState();
    expect(final.screenPhase).toBe('settlement');
    expect(final.resultQueue).toHaveLength(1);
    expect(final.resultQueue[0]).toEqual({ result: 'win', amount: 50 }); // 19 vs 17
  });

  it('double: commits dealerTurn (with the dealer having actually hit and revealed the extra card) before settlement', async () => {
    await useGameStore.getState().startBuyIn(500);

    // deck pop() order: player's double-draw card first, then the dealer's hit.
    const game: GameState = {
      deck: [card('3', 'Clubs') /* dealer's hit */, card('2', 'Diamonds') /* player's double draw */],
      dealerHand: [card('9'), card('7')], // 16, must hit
      playerHands: [{ cards: [card('10'), card('7')], bet: 50, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, screenPhase: 'playerTurn' });

    const pending = useGameStore.getState().double();

    const mid = useGameStore.getState();
    expect(mid.screenPhase).toBe('dealerTurn');
    expect(mid.dealer?.holeRevealed).toBe(true);
    // The dealer's hit card (3♣) must already be present and visible — proves
    // playDealerTurn() ran, and its result was committed, before the pause.
    expect(mid.dealer?.cards).toEqual([card('9'), card('7'), card('3', 'Clubs')]);
    expect(mid.dealer?.visibleTotal).toBe(19);
    expect(mid.playerHands[0].bet).toBe(100); // doubled
    expect(mid.resultQueue).toEqual([]);

    await settleAndFlush(pending, 1); // dealer hit exactly once (16 -> 19)

    const final = useGameStore.getState();
    expect(final.screenPhase).toBe('settlement');
    expect(final.resultQueue).toHaveLength(1);
    expect(final.resultQueue[0]).toEqual({ result: 'push', amount: 0 }); // 19 vs 19
  });

  it('post-split completion: standing on the last unfinished split hand commits dealerTurn (both hands frozen) before settlement, then settles both hands', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('10'), card('10')], // 20, already stands
      playerHands: [
        { cards: [card('9'), card('9')], bet: 50, isDoubled: false, isStood: true, isBusted: false }, // hand 1 already finished
        { cards: [card('10'), card('6')], bet: 50, isDoubled: false, isStood: false, isBusted: false }, // hand 2 active
      ],
      currentHandIndex: 1,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, screenPhase: 'playerTurn' });

    const pending = useGameStore.getState().stand();

    const mid = useGameStore.getState();
    expect(mid.screenPhase).toBe('dealerTurn');
    expect(mid.dealer?.holeRevealed).toBe(true);
    expect(mid.dealer?.visibleTotal).toBe(20);
    // Both split hands stay visible/frozen in their final state.
    expect(mid.playerHands).toHaveLength(2);
    expect(mid.playerHands[0].total).toBe(18);
    expect(mid.playerHands[1].total).toBe(16);
    expect(mid.resultQueue).toEqual([]);

    await settleAndFlush(pending, 0); // no hit needed

    const final = useGameStore.getState();
    expect(final.screenPhase).toBe('settlement');
    // Both hands settled independently (docs/blackjack-game-logic.md section 8).
    expect(final.resultQueue).toEqual([
      { result: 'lose', amount: -50 }, // 18 vs 20
      { result: 'lose', amount: -50 }, // 16 vs 20
    ]);
  });
});

describe('startRound immediate-natural-blackjack path (same fix applied here)', () => {
  // The real gameEngine.startRound shuffles a real deck, so these tests can't
  // get a deterministic natural blackjack through it. Mocking just that one
  // export (everything else — resolveOutcome, playDealerTurn, scoring, etc.
  // — stays real) lets startRound's own settlement-detection branch actually
  // run against a controlled deal.
  function mockDeal(dealtGame: GameState): void {
    jest.doMock('../../game/gameEngine', () => {
      const actual = jest.requireActual('../../game/gameEngine');
      return { ...actual, startRound: jest.fn(() => dealtGame) };
    });
  }

  it('player natural blackjack: dealerTurn committed (dealer hand revealed) before settlement, pays 3:2', async () => {
    const dealtGame: GameState = {
      deck: [],
      dealerHand: [card('10'), card('9')], // 19, not a natural
      playerHands: [{ cards: [card('A'), card('K')], bet: 50, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'settlement', // gameEngine.startRound already resolves this immediately
    };
    mockDeal(dealtGame);
    requireFreshStore();

    await useGameStore.getState().startBuyIn(500);
    const pending = useGameStore.getState().startRound(50);

    const mid = useGameStore.getState();
    expect(mid.screenPhase).toBe('dealerTurn');
    expect(mid.dealer?.holeRevealed).toBe(true);
    expect(mid.dealer?.cards).toEqual([card('10'), card('9')]);
    expect(mid.dealer?.visibleTotal).toBe(19);
    expect(mid.resultQueue).toEqual([]);

    await settleAndFlush(pending, 0); // natural blackjack — nothing for the dealer to hit

    const final = useGameStore.getState();
    expect(final.screenPhase).toBe('settlement');
    expect(final.resultQueue).toEqual([{ result: 'blackjack', amount: 75 }]); // round(50 * 1.5)
  });

  it('both natural blackjack: dealerTurn committed before settlement, resolves as a push', async () => {
    const dealtGame: GameState = {
      deck: [],
      dealerHand: [card('A'), card('Q')],
      playerHands: [{ cards: [card('A'), card('K')], bet: 50, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'settlement',
    };
    mockDeal(dealtGame);
    requireFreshStore();

    await useGameStore.getState().startBuyIn(500);
    const pending = useGameStore.getState().startRound(50);

    const mid = useGameStore.getState();
    expect(mid.screenPhase).toBe('dealerTurn');
    expect(mid.dealer?.holeRevealed).toBe(true);
    expect(mid.dealer?.cards).toEqual([card('A'), card('Q')]);
    expect(mid.resultQueue).toEqual([]);

    await settleAndFlush(pending, 0);

    const final = useGameStore.getState();
    expect(final.screenPhase).toBe('settlement');
    expect(final.resultQueue).toEqual([{ result: 'push', amount: 0 }]);
  });

  it('dealer-only natural blackjack: dealerTurn committed before settlement, player loses', async () => {
    const dealtGame: GameState = {
      deck: [],
      dealerHand: [card('A'), card('J')],
      playerHands: [{ cards: [card('10'), card('9')], bet: 50, isDoubled: false, isStood: false, isBusted: false }], // 19, not a natural
      currentHandIndex: 0,
      roundPhase: 'settlement',
    };
    mockDeal(dealtGame);
    requireFreshStore();

    await useGameStore.getState().startBuyIn(500);
    const pending = useGameStore.getState().startRound(50);

    const mid = useGameStore.getState();
    expect(mid.screenPhase).toBe('dealerTurn');
    expect(mid.dealer?.holeRevealed).toBe(true);
    expect(mid.dealer?.cards).toEqual([card('A'), card('J')]);
    expect(mid.resultQueue).toEqual([]);

    await settleAndFlush(pending, 0);

    const final = useGameStore.getState();
    expect(final.screenPhase).toBe('settlement');
    expect(final.resultQueue).toEqual([{ result: 'lose', amount: -50 }]);
  });
});

describe('dealer-turn pause duration scales with how many cards the dealer actually draws', () => {
  beforeEach(() => {
    requireFreshStore();
  });

  it('no-hit scenario (dealer already 17+): the fixed baseline is exactly enough, not before', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('10'), card('7')], // 17, no hit needed
      playerHands: [{ cards: [card('10'), card('9')], bet: 50, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, screenPhase: 'playerTurn' });

    expect(dealerTurnPauseMs(0)).toBe(DEALER_TURN_DISPLAY_MS);

    const pending = useGameStore.getState().stand();

    jest.advanceTimersByTime(DEALER_TURN_DISPLAY_MS - 1);
    expect(useGameStore.getState().screenPhase).toBe('dealerTurn'); // not yet

    jest.advanceTimersByTime(1);
    await pending;
    expect(useGameStore.getState().screenPhase).toBe('settlement');
  });

  it('multi-hit scenario (dealer draws 5 cards climbing from 4 up through 17+) waits strictly longer than the no-hit baseline', async () => {
    await useGameStore.getState().startBuyIn(500);

    // 4 -> +3 -> 7 -> +3 -> 10 -> +3 -> 13 -> +3 -> 16 -> +3 -> 19: 5 hits,
    // each total still under 17 until the last. Deliberately this many (not
    // just 2-3) — with the current 150ms stagger / 300ms duration / 400ms
    // read buffer, anything under ~5 extra cards doesn't actually exceed the
    // fixed 1200ms baseline, so a smaller example wouldn't prove the dynamic
    // path engages at all.
    const deck = [
      card('3', 'Clubs'),
      card('3', 'Diamonds'),
      card('3', 'Hearts'),
      card('3', 'Spades'),
      card('3', 'Clubs'),
    ];
    const game: GameState = {
      deck,
      dealerHand: [card('2'), card('2', 'Hearts')], // 4, must hit repeatedly
      playerHands: [{ cards: [card('10'), card('9')], bet: 50, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, screenPhase: 'playerTurn' });

    const expectedPauseMs = dealerTurnPauseMs(5);
    // Sanity check on the scenario itself, not just the implementation: this
    // has to actually exceed the baseline, or the assertions below prove nothing.
    expect(expectedPauseMs).toBeGreaterThan(DEALER_TURN_DISPLAY_MS);

    const pending = useGameStore.getState().stand();

    // The no-hit baseline alone must NOT be enough here — this is what
    // actually proves the pause scaled up, not just that settlement
    // eventually happens however long we wait.
    jest.advanceTimersByTime(DEALER_TURN_DISPLAY_MS);
    expect(useGameStore.getState().screenPhase).toBe('dealerTurn');

    jest.advanceTimersByTime(expectedPauseMs - DEALER_TURN_DISPLAY_MS);
    await pending;

    expect(useGameStore.getState().screenPhase).toBe('settlement');
    expect(useGameStore.getState().dealer?.cards).toHaveLength(2 + 5); // all 5 hits actually happened
  });
});

describe('settlement auto-return (blackjack-app-spec.md section 5b — Result overlay removed)', () => {
  beforeEach(() => {
    requireFreshStore();
  });

  it('auto-returns to betting after SETTLEMENT_PAUSE_MS, clearing the round and resultQueue', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('10'), card('7')], // 17, no hit needed
      playerHands: [{ cards: [card('10'), card('9')], bet: 50, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, screenPhase: 'playerTurn' });

    const pending = useGameStore.getState().stand();
    await settleAndFlush(pending, 0);

    // Settled, but the auto-return timer hasn't fired yet — resultQueue must
    // still be visible long enough for the In-Play pulse color to be derived
    // from it (GameplayScreen reads resultQueue to compute that color).
    expect(useGameStore.getState().screenPhase).toBe('settlement');
    expect(useGameStore.getState().resultQueue).toHaveLength(1);

    jest.advanceTimersByTime(SETTLEMENT_PAUSE_MS - 1);
    expect(useGameStore.getState().screenPhase).toBe('settlement'); // not yet

    jest.advanceTimersByTime(1);
    const final = useGameStore.getState();
    expect(final.screenPhase).toBe('betting');
    expect(final.resultQueue).toEqual([]);
    expect(final.game).toBeNull();
    expect(final.dealer).toBeNull();
    expect(final.playerHands).toEqual([]);
  });

  it('auto-returns to the mid-game Buy-in Sheet instead of betting when the loss brings In-Play to exactly 0', async () => {
    await useGameStore.getState().startBuyIn(50);

    const game: GameState = {
      deck: [],
      dealerHand: [card('10'), card('9')], // 19, no hit needed
      playerHands: [{ cards: [card('10'), card('6')], bet: 50, isDoubled: false, isStood: false, isBusted: false }], // 16, loses
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, screenPhase: 'playerTurn' });

    const pending = useGameStore.getState().stand();
    await settleAndFlush(pending, 0);
    expect(useGameStore.getState().inPlay).toBe(0); // 50 - 50 bet lost

    jest.advanceTimersByTime(SETTLEMENT_PAUSE_MS);
    expect(useGameStore.getState().screenPhase).toBe('buyInSheet');
  });
});

describe('Cancel Bet flow (blackjack-app-spec.md section 5b)', () => {
  beforeEach(() => {
    requireFreshStore();
  });

  it('cancelBet reaches the "waiting" idle state without creating a GameState', async () => {
    await useGameStore.getState().startBuyIn(500);
    expect(useGameStore.getState().screenPhase).toBe('betting');

    useGameStore.getState().cancelBet();

    const state = useGameStore.getState();
    expect(state.screenPhase).toBe('waiting');
    // Purely presentational — no round was dealt.
    expect(state.game).toBeNull();
    expect(state.dealer).toBeNull();
    expect(state.playerHands).toEqual([]);
    // Session/In-Play are untouched by canceling.
    expect(state.inPlay).toBe(500);
    expect(state.session).not.toBeNull();
  });

  it('openPlaceBetSheet reopens the Place Bet Sheet ("betting") from "waiting"', () => {
    useGameStore.setState({ screenPhase: 'waiting' });

    useGameStore.getState().openPlaceBetSheet();

    expect(useGameStore.getState().screenPhase).toBe('betting');
  });
});

describe('confirmLeaveTable (blackjack-app-spec.md section 5b)', () => {
  beforeEach(() => {
    requireFreshStore();
  });

  it('between rounds: credits remaining In-Play to Balance and closes the session, with no forfeiture', async () => {
    await useGameStore.getState().startBuyIn(500);
    useGameStore.setState({ inPlay: 350, screenPhase: 'betting' });

    const db = await getDatabase();
    expect(await getHandsPlayed(db)).toBe(0);

    await useGameStore.getState().confirmLeaveTable();

    const final = useGameStore.getState();
    expect(final.session).toBeNull();
    expect(final.inPlay).toBeNull();
    expect(final.screenPhase).toBe('idle');
    // This is what actually proves the wiring, not just that leaveTable()
    // itself is correct: starting balance - 500 buy-in + 350 remaining
    // In-Play credited back.
    expect(final.balance).toBe(INITIAL_BALANCE - 500 + 350);
    expect(await getHandsPlayed(db)).toBe(0); // still nothing forfeited
  });

  it('mid-hand: forfeits the active hand as a loss, then credits whatever In-Play remains after forfeiture', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('K'), card('9')], // 19 — irrelevant, not revealed/used for a forfeited hand
      playerHands: [{ cards: [card('10'), card('7')], bet: 80, isDoubled: false, isStood: false, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, inPlay: 350, screenPhase: 'playerTurn' });

    const db = await getDatabase();
    await useGameStore.getState().confirmLeaveTable();

    const final = useGameStore.getState();
    expect(final.session).toBeNull();
    expect(final.screenPhase).toBe('idle');
    // 350 in play - 80 forfeited bet = 270 credited back.
    expect(final.balance).toBe(INITIAL_BALANCE - 500 + 270);

    expect(await getHandsPlayed(db)).toBe(1);
  });

  it('mid-hand with a split (one hand already finished, one still active): forfeits BOTH hands, not just the active one', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('K'), card('9')],
      playerHands: [
        { cards: [card('9'), card('9')], bet: 50, isDoubled: false, isStood: true, isBusted: false }, // finished, not yet settled
        { cards: [card('10'), card('4')], bet: 50, isDoubled: false, isStood: false, isBusted: false }, // still active
      ],
      currentHandIndex: 1,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, inPlay: 400, screenPhase: 'playerTurn' });

    const db = await getDatabase();
    await useGameStore.getState().confirmLeaveTable();

    // 400 in play - 50 - 50 = 300 credited back.
    expect(useGameStore.getState().balance).toBe(INITIAL_BALANCE - 500 + 300);
    expect(await getHandsPlayed(db)).toBe(2);
  });

  it('mid-hand where the active hand already busted: forfeits it as "bust", not "lose"', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('K'), card('9')],
      playerHands: [
        { cards: [card('10'), card('9'), card('5')], bet: 50, isDoubled: false, isStood: false, isBusted: true },
      ],
      currentHandIndex: 0,
      roundPhase: 'playerTurn',
    };
    useGameStore.setState({ game, inPlay: 200, screenPhase: 'playerTurn' });

    const db = await getDatabase();
    await useGameStore.getState().confirmLeaveTable();

    const row = await db.getFirstAsync<{ result: string }>('SELECT result FROM hands ORDER BY id DESC LIMIT 1');
    expect(row?.result).toBe('bust');
  });

  it('from the Cancel Bet "waiting" state: credits the full In-Play back to Balance, with no forfeiture (no hand exists yet)', async () => {
    await useGameStore.getState().startBuyIn(500);
    useGameStore.getState().cancelBet();
    expect(useGameStore.getState().screenPhase).toBe('waiting');

    const db = await getDatabase();
    expect(await getHandsPlayed(db)).toBe(0);

    await useGameStore.getState().confirmLeaveTable();

    const final = useGameStore.getState();
    expect(final.session).toBeNull();
    expect(final.screenPhase).toBe('idle');
    // Full 500 buy-in credited back — nothing was ever bet or forfeited.
    expect(final.balance).toBe(INITIAL_BALANCE);
    expect(await getHandsPlayed(db)).toBe(0); // still nothing forfeited
  });

  it('between rounds during dealerTurn is NOT treated as mid-round — only playerTurn/insurance/dealerTurn are, and dealerTurn IS one of them: forfeits without revealing/finishing the dealer', async () => {
    await useGameStore.getState().startBuyIn(500);

    const game: GameState = {
      deck: [],
      dealerHand: [card('2'), card('3')], // 5 — would need several hits to resolve; must NOT be played out
      playerHands: [{ cards: [card('10'), card('8')], bet: 60, isDoubled: false, isStood: true, isBusted: false }],
      currentHandIndex: 0,
      roundPhase: 'dealerTurn',
    };
    useGameStore.setState({ game, inPlay: 300, screenPhase: 'dealerTurn' });

    const db = await getDatabase();
    await useGameStore.getState().confirmLeaveTable();

    // 300 - 60 = 240 credited back.
    expect(useGameStore.getState().balance).toBe(INITIAL_BALANCE - 500 + 240);
    const row = await db.getFirstAsync<{ dealer_final_score: number; result: string }>(
      'SELECT dealer_final_score, result FROM hands ORDER BY id DESC LIMIT 1',
    );
    expect(row?.result).toBe('lose');
    // Recorded exactly as it stood (5) — never played out to see what it
    // would have finished at, per "no dealer reveal... not played out."
    expect(row?.dealer_final_score).toBe(5);
  });
});
