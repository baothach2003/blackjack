import { create } from 'zustand';
import {
  GameState,
  Outcome,
  playDealerTurn,
  playerDouble,
  playerHit,
  playerSplit,
  playerStand,
  resolveOutcome,
  splitValue,
  startRound as engineStartRound,
} from '../game/gameEngine';
import { calculateScore } from '../game/scoring';
import { Card } from '../game/types';
import { getDatabase } from '../storage/db';
import { dealAnimation } from '../theme/tokens';
import {
  getBiggestWin,
  getHandsPlayed,
  getNaturalBlackjackCount,
  getWinRate,
  HandData,
  HandResult,
  insertHand,
} from '../storage/handsRepository';
import { endSession, Session, startSession } from '../storage/sessionsRepository';
import {
  debitForBuyIn,
  getBalance,
  resetBalanceForTesting as devResetBalance,
} from '../storage/walletRepository';

// The only layer allowed to know about both src/game/ and src/storage/ per
// CLAUDE.md section 3.3 — screens/components call into this store only, never
// gameEngine.ts or the repositories directly.

export interface HandView {
  cards: Card[];
  total: number;
  isSoft: boolean;
  isBusted: boolean;
  isStood: boolean;
  isDoubled: boolean;
  bet: number;
}

export interface DealerView {
  // Convention (undocumented elsewhere, decided here): dealerHand[0] is
  // always the up-card, dealerHand[1] is the hole card, dealerHand[2+] are
  // the dealer's own hits — all only ever dealt after the hole is revealed.
  cards: Card[];
  holeRevealed: boolean;
  visibleTotal: number;
}

export type ScreenPhase =
  | 'idle' // no active session
  | 'betting' // Place Bet Sheet
  | 'waiting' // blackjack-app-spec.md section 5b's Cancel Bet flow: the Place
  // Bet Sheet was dismissed via "Cancel" rather than a confirmed bet. No
  // GameState exists (game stays null, same as 'idle'/'betting' before a
  // round is ever dealt) — GameplayScreen shows decorative face-down cards
  // in place of a real hand and swaps Hit/Stand/Double for a single
  // full-width "Place Bet" bar that reopens the sheet via openPlaceBetSheet().
  // Deliberately NOT in confirmLeaveTable's midRoundPhases list below — no
  // hand exists yet, so leaving from here must never forfeit anything.
  | 'insurance' // Insurance Yes/No swapped in for Hit/Stand/Double
  | 'playerTurn' // Hit/Stand/Double
  | 'dealerTurn' // dealer's hand fully revealed/played, no action buttons, no overlay yet
  | 'settlement' // no overlay (blackjack-app-spec.md 5b supersedes 3.10) — the
  // In-Play AnimatedNumber's own color pulse is the only settlement
  // feedback; resultQueue holds the hand(s) just settled until the
  // auto-transition below clears it
  | 'buyInSheet'; // In-Play hit 0 — mid-game Buy-in Sheet

// Bug fix: the Result overlay was appearing before the player could see the
// dealer's revealed hand, because the old code went straight from
// 'playerTurn' to settlement with no committed, separately-rendered
// 'dealerTurn' state in between — playDealerTurn() and settleRound() ran back
// to back, gated only by a local DB write (single-digit ms), not by anything
// a human could perceive.
//
// This is the baseline/minimum pause — used as-is when there's nothing to
// wait for (0 extra cards: a natural blackjack, or a dealer already at 17+).
// When the dealer actually draws, dealerTurnPauseMs() below scales past this
// baseline so the pause always outlasts the dealer's own card-deal
// animations (Card.tsx / theme/tokens.ts's dealAnimation, added in Phase 5) —
// a fixed pause alone can't guarantee that once the dealer draws enough cards.
export const DEALER_TURN_DISPLAY_MS = 1200;

// Extra time after the last card's slide-in animation finishes, so the
// player actually has a moment to register the dealer's final hand/total —
// not just exactly as long as the animation itself takes.
const DEALER_TURN_READ_BUFFER_MS = 400;

// extraCardsDrawn: how many cards the dealer hit for this round (0 for a
// natural blackjack, or a dealer already at 17+ with nothing to hit).
// DealerArea's own auto-stagger (theme/tokens.ts's dealAnimation) starts the
// dealer's Nth extra card at (N-1) * staggerMs and it takes durationMs to
// finish sliding in, so the last card's animation completes at
// (extraCardsDrawn - 1) * staggerMs + durationMs after the dealerTurn state
// is committed.
export function dealerTurnPauseMs(extraCardsDrawn: number): number {
  if (extraCardsDrawn <= 0) {
    return DEALER_TURN_DISPLAY_MS;
  }
  const lastCardAnimationEndMs = (extraCardsDrawn - 1) * dealAnimation.staggerMs + dealAnimation.durationMs;
  return Math.max(DEALER_TURN_DISPLAY_MS, lastCardAnimationEndMs + DEALER_TURN_READ_BUFFER_MS);
}

// blackjack-app-spec.md section 5b: with the Result overlay/"Next Hand"
// button gone, the only settlement feedback is the In-Play number's own
// color pulse (AnimatedNumber's count animation is DURATION_MS = 400ms, see
// components/AnimatedNumber.tsx). This needs to comfortably outlast that
// count so the player actually registers the new number and its color
// before the screen auto-returns to the Place Bet Sheet — chosen as roughly
// the same order of magnitude as DEALER_TURN_DISPLAY_MS's read buffer above
// it, not derived from anything stricter. Flagged to the user as a pacing
// judgment call to confirm on-device, same as DEALER_TURN_DISPLAY_MS was.
export const SETTLEMENT_PAUSE_MS = 1800;

export interface PendingResult {
  result: HandResult;
  amount: number; // signed net change to In-Play for this hand
}

// ProfileScreen's Statistics section (blackjack-app-spec.md section 3.11 /
// the Profile mockup): Win Rate, Biggest Win, Hands Played, Blackjacks Hit.
export interface ProfileStats {
  winRate: number; // 0-1 fraction
  biggestWin: number;
  handsPlayed: number;
  naturalBlackjackCount: number;
}

function toHandResult(outcome: Outcome, isBusted: boolean): HandResult {
  return isBusted ? 'bust' : outcome;
}

// docs/blackjack-app-spec.md section 5b: confirmed 3:2 blackjack payout. This
// is the first and only place that ratio is applied — hands doesn't store it
// (CLAUDE.md section 3.2), and gameEngine's resolveOutcome only names the
// outcome, it doesn't compute chip amounts.
function payoutFor(outcome: Outcome, isBusted: boolean, bet: number): number {
  if (isBusted || outcome === 'lose') return -bet;
  if (outcome === 'push') return 0;
  if (outcome === 'blackjack') return Math.round(bet * 1.5);
  return bet; // 'win', 1:1
}

function deriveDealerView(game: GameState): DealerView {
  const holeRevealed = game.roundPhase === 'settlement';
  const visibleCards = holeRevealed ? game.dealerHand : game.dealerHand.slice(0, 1);
  return {
    cards: game.dealerHand,
    holeRevealed,
    visibleTotal: calculateScore(visibleCards).score,
  };
}

function deriveHandViews(game: GameState): HandView[] {
  return game.playerHands.map((hand) => {
    const { score, isSoft } = calculateScore(hand.cards);
    return {
      cards: hand.cards,
      total: score,
      isSoft,
      isBusted: hand.isBusted,
      isStood: hand.isStood,
      isDoubled: hand.isDoubled,
      bet: hand.bet,
    };
  });
}

// Double/Split eligibility, derived here (not in the screen) so the UI never
// needs to reach into gameEngine's rules (an untouched 2-card hand for
// Double; two cards of matching point-value, via gameEngine's own
// splitValue, for Split) — project-plan.md Phase 2: "double only enabled
// when eligible" applies the same way to Split.
function deriveActionEligibility(game: GameState): { canDouble: boolean; canSplit: boolean } {
  const activeHand = game.playerHands[game.currentHandIndex];
  if (!activeHand || activeHand.cards.length !== 2) {
    return { canDouble: false, canSplit: false };
  }
  const [first, second] = activeHand.cards;
  return {
    canDouble: true,
    canSplit: splitValue(first.rank) === splitValue(second.rank),
  };
}

interface GameStoreState {
  balance: number | null;
  session: Session | null;
  inPlay: number | null;

  game: GameState | null;
  dealer: DealerView | null;
  playerHands: HandView[];
  currentHandIndex: number;
  canDouble: boolean;
  canSplit: boolean;

  screenPhase: ScreenPhase;
  resultQueue: PendingResult[];
  insuranceResolved: boolean;

  stats: ProfileStats | null;

  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  loadStats: () => Promise<void>;
  startBuyIn: (amount: number) => Promise<void>;
  rebuy: (amount: number) => Promise<void>;
  startRound: (bet: number) => Promise<void>;
  cancelBet: () => void;
  openPlaceBetSheet: () => void;
  takeInsurance: (yes: boolean) => void;
  hit: () => Promise<void>;
  stand: () => Promise<void>;
  double: () => Promise<void>;
  split: () => Promise<void>;
  leaveTable: () => Promise<void>;
  confirmLeaveTable: () => Promise<void>;
  // DEV/QA-ONLY — see storage/walletRepository.resetBalanceForTesting.
  // Remove or gate this before Phase 8 (packaging).
  resetBalanceForTesting: (amount?: number) => Promise<void>;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  // Shared by every path that ends a round — normal hit/stand/double/
  // post-split completion AND startRound's immediate-natural-blackjack
  // branch. `resolvedGame` must already be fully resolved (roundPhase:
  // 'settlement') by the time this is called — callers are responsible for
  // actually playing out the dealer's hits first, if there are any; a
  // natural blackjack has nothing to hit, so the freshly-dealt game is
  // already resolved as-is and can be passed straight through.
  //
  // Deliberately commits TWO separate states rather than jumping straight to
  // settlement:
  //   1. 'dealerTurn' — the dealer's hand fully played out and revealed, held
  //      for dealerTurnPauseMs(extraCardsDrawn) so the player actually sees
  //      it — long enough for the dealer's own card-deal animations to
  //      finish, not just the fixed DEALER_TURN_DISPLAY_MS baseline.
  //   2. 'settlement' — only after that pause, once settleRound has written
  //      the hand(s) and populated resultQueue.
  // extraCardsDrawn: how many cards the dealer hit to reach this resolvedGame
  // (0 for a natural blackjack, or a dealer already at 17+) — callers compute
  // this themselves since they're the ones who know the "before" hand size.
  async function revealDealerThenSettle(resolvedGame: GameState, extraCardsDrawn: number) {
    const { canDouble, canSplit } = deriveActionEligibility(resolvedGame);

    // Step 1: commit the dealer's fully-revealed hand as its own state. This
    // must actually render before settlement — no action buttons show during
    // 'dealerTurn' (GameplayScreen only shows them for 'playerTurn'/
    // 'insurance'), and the In-Play number hasn't moved/pulsed yet either.
    set({
      game: resolvedGame,
      dealer: deriveDealerView(resolvedGame),
      playerHands: deriveHandViews(resolvedGame),
      currentHandIndex: resolvedGame.currentHandIndex,
      canDouble,
      canSplit,
      screenPhase: 'dealerTurn',
    });

    // Step 2: pace the pause to always outlast the dealer's own card-deal
    // animations — see dealerTurnPauseMs above.
    await new Promise((resolve) => setTimeout(resolve, dealerTurnPauseMs(extraCardsDrawn)));

    // Step 3: settle now, which sets screenPhase to 'settlement' once the
    // hand(s) are written and resultQueue is populated.
    await settleRound(resolvedGame);
  }

  // Runs after any gameEngine transition that could end the player's turn
  // (hit-into-bust on the last hand, stand, double, or the last split hand
  // finishing). Not part of the public action list — an internal
  // continuation shared by hit/stand/double.
  async function applyGameState(nextGame: GameState) {
    if (nextGame.roundPhase !== 'dealerTurn') {
      // Player's turn continues: a hit that didn't bust, or focus moved to
      // the next unfinished split hand. No dealer turn involved yet.
      const { canDouble, canSplit } = deriveActionEligibility(nextGame);
      set({
        game: nextGame,
        dealer: deriveDealerView(nextGame),
        playerHands: deriveHandViews(nextGame),
        currentHandIndex: nextGame.currentHandIndex,
        canDouble,
        canSplit,
        screenPhase: 'playerTurn',
      });
      return;
    }

    const dealerCardsBeforeTurn = nextGame.dealerHand.length;
    const resolvedGame = playDealerTurn(nextGame);
    const extraCardsDrawn = resolvedGame.dealerHand.length - dealerCardsBeforeTurn;

    await revealDealerThenSettle(resolvedGame, extraCardsDrawn);
  }

  // Settles every player hand independently against the single dealer hand
  // (docs/blackjack-game-logic.md section 8), writing one hands row per hand
  // and accumulating In-Play changes in order, then populates resultQueue —
  // consumed by GameplayScreen only to compute the In-Play AnimatedNumber's
  // pulse color (sum of every queued hand's amount; positive net = green,
  // negative = red, exactly zero = no color), not to step through hands one
  // at a time anymore (blackjack-app-spec.md 5b removed the Result overlay).
  async function settleRound(game: GameState) {
    const { session } = get();
    if (!session) return;

    const db = await getDatabase();
    const dealerScore = calculateScore(game.dealerHand).score;

    let runningInPlay = get().inPlay ?? 0;
    const queue: PendingResult[] = [];

    for (const hand of game.playerHands) {
      const outcome = resolveOutcome(hand.cards, game.dealerHand);
      const result = toHandResult(outcome, hand.isBusted);
      const amount = payoutFor(outcome, hand.isBusted, hand.bet);
      runningInPlay += amount;

      const handData: HandData = {
        betAmount: hand.bet,
        result,
        playerFinalScore: calculateScore(hand.cards).score,
        dealerFinalScore: dealerScore,
        inPlayAfter: runningInPlay,
      };
      await insertHand(db, session.id, handData);

      queue.push({ result, amount });
    }

    set({ inPlay: runningInPlay, resultQueue: queue, screenPhase: 'settlement' });

    // Auto-return to betting (or the mid-game Buy-in Sheet, if In-Play hit
    // exactly 0) after a fixed pause — there's no button to tap anymore.
    // Deliberately NOT awaited: settleRound's own callers (hit/stand/double/
    // startRound, via revealDealerThenSettle) must keep resolving as soon as
    // the settlement state itself is visible, same as before this change —
    // this is a fire-and-forget continuation, not part of that chain. (Also
    // why existing tests that await those callers and only advance timers up
    // to dealerTurnPauseMs still pass unmodified — they never advance far
    // enough to observe this timer firing.)
    setTimeout(() => {
      const { inPlay } = get();
      set({
        game: null,
        dealer: null,
        playerHands: [],
        resultQueue: [],
        screenPhase: inPlay === 0 ? 'buyInSheet' : 'betting',
      });
    }, SETTLEMENT_PAUSE_MS);
  }

  return {
    balance: null,
    session: null,
    inPlay: null,

    game: null,
    dealer: null,
    playerHands: [],
    currentHandIndex: 0,
    canDouble: false,
    canSplit: false,

    screenPhase: 'idle',
    resultQueue: [],
    insuranceResolved: false,

    stats: null,

    isLoading: false,
    error: null,

    initialize: async () => {
      set({ isLoading: true, error: null });
      try {
        const db = await getDatabase();
        const balance = await getBalance(db);
        set({ balance, isLoading: false });
      } catch (err) {
        set({ isLoading: false, error: (err as Error).message });
      }
    },

    // ProfileScreen calls this instead of handsRepository directly, per
    // CLAUDE.md section 3.3 — same rule as every other screen, read-only
    // queries included.
    loadStats: async () => {
      set({ isLoading: true, error: null });
      try {
        const db = await getDatabase();
        const [winRate, biggestWin, handsPlayed, naturalBlackjackCount] = await Promise.all([
          getWinRate(db),
          getBiggestWin(db),
          getHandsPlayed(db),
          getNaturalBlackjackCount(db),
        ]);
        set({
          stats: { winRate, biggestWin, handsPlayed, naturalBlackjackCount },
          isLoading: false,
        });
      } catch (err) {
        set({ isLoading: false, error: (err as Error).message });
      }
    },

    // Buy-in: debits Balance, opens a session, sets In-Play — CLAUDE.md
    // section 3.2's only Balance-changing operation besides Leave The Table.
    startBuyIn: async (amount: number) => {
      set({ isLoading: true, error: null });
      try {
        const db = await getDatabase();
        const session = await startSession(db, amount);
        const balance = await getBalance(db);
        set({
          session,
          balance,
          inPlay: amount,
          screenPhase: 'betting',
          isLoading: false,
        });
      } catch (err) {
        set({ isLoading: false, error: (err as Error).message });
        throw err;
      }
    },

    // Mid-game re-buy (blackjack-app-spec.md section 3.4): adds to the
    // *current* session's In-Play rather than starting a new session/table
    // sit-down — deliberately not the same as startBuyIn, which creates a
    // new sessions row. Caveat: this amount is only tracked in this store's
    // in-memory `inPlay` for the rest of the live session; the schema (fixed
    // per CLAUDE.md section 3.2) has no field to record a re-buy event
    // distinctly from a played hand, so `getCurrentInPlay` reconstructed from
    // a cold app restart mid-session would not reflect it. The Balance debit
    // itself is durable; only that bookkeeping link isn't. Flagging rather
    // than inventing a new column to paper over it.
    rebuy: async (amount: number) => {
      const { inPlay } = get();
      if (inPlay === null) return;

      set({ isLoading: true, error: null });
      try {
        const db = await getDatabase();
        await debitForBuyIn(db, amount);
        const balance = await getBalance(db);
        set({ balance, inPlay: inPlay + amount, screenPhase: 'betting', isLoading: false });
      } catch (err) {
        set({ isLoading: false, error: (err as Error).message });
        throw err;
      }
    },

    startRound: async (bet: number) => {
      set({ insuranceResolved: false, resultQueue: [], error: null });
      const game = engineStartRound(bet);

      if (game.roundPhase === 'settlement') {
        // Natural blackjack on the deal (either side, or both — a push).
        // Nothing for the dealer to hit (extraCardsDrawn: 0 — the pause
        // falls back to the fixed DEALER_TURN_DISPLAY_MS baseline), but the
        // hole card still needs a beat to be revealed before the result
        // appears, same as any other round-ending path.
        await revealDealerThenSettle(game, 0);
        return;
      }

      const dealerUpCardIsAce = game.dealerHand[0]?.rank === 'A';
      const { canDouble, canSplit } = deriveActionEligibility(game);

      set({
        game,
        dealer: deriveDealerView(game),
        playerHands: deriveHandViews(game),
        currentHandIndex: game.currentHandIndex,
        canDouble,
        canSplit,
        screenPhase: dealerUpCardIsAce ? 'insurance' : 'playerTurn',
      });
    },

    // blackjack-app-spec.md section 5b Cancel Bet flow: dismisses the Place
    // Bet Sheet without dealing anything. No DB/session work — game is
    // already null at this point (a round hasn't started), so this is just
    // a screenPhase flip to the decorative "waiting at table" state.
    cancelBet: () => {
      set({ screenPhase: 'waiting' });
    },

    // Reopens the Place Bet Sheet from the 'waiting' state (tapping the
    // full-width "Place Bet" bar). Symmetric with cancelBet — also just a
    // screenPhase flip, no side effects.
    openPlaceBetSheet: () => {
      set({ screenPhase: 'betting' });
    },

    // Insurance's actual side-bet payout isn't implemented: gameEngine.ts has
    // no insurance mechanic, and docs/blackjack-game-logic.md section 3
    // explicitly allows skipping it in the base version. This only dismisses
    // the prompt so the player's turn can proceed with Hit/Stand/Double.
    takeInsurance: (_yes: boolean) => {
      set({ insuranceResolved: true, screenPhase: 'playerTurn' });
    },

    hit: async () => {
      const { game } = get();
      if (!game) return;
      try {
        await applyGameState(playerHit(game));
      } catch (err) {
        set({ error: (err as Error).message });
      }
    },

    stand: async () => {
      const { game } = get();
      if (!game) return;
      try {
        await applyGameState(playerStand(game));
      } catch (err) {
        set({ error: (err as Error).message });
      }
    },

    double: async () => {
      const { game } = get();
      if (!game) return;
      try {
        await applyGameState(playerDouble(game));
      } catch (err) {
        set({ error: (err as Error).message });
      }
    },

    split: async () => {
      const { game } = get();
      if (!game) return;
      try {
        const next = playerSplit(game);
        const { canDouble, canSplit } = deriveActionEligibility(next);
        set({
          game: next,
          dealer: deriveDealerView(next),
          playerHands: deriveHandViews(next),
          currentHandIndex: next.currentHandIndex,
          canDouble,
          canSplit,
        });
      } catch (err) {
        set({ error: (err as Error).message });
      }
    },

    // Leave The Table: closes the session, credits remaining In-Play back to
    // Balance — CLAUDE.md section 3.2's other Balance-changing operation.
    leaveTable: async () => {
      const { session, inPlay } = get();
      if (!session || inPlay === null) return;

      set({ isLoading: true, error: null });
      try {
        const db = await getDatabase();
        await endSession(db, session.id, inPlay);
        const balance = await getBalance(db);
        set({
          session: null,
          inPlay: null,
          balance,
          game: null,
          dealer: null,
          playerHands: [],
          resultQueue: [],
          screenPhase: 'idle',
          isLoading: false,
        });
      } catch (err) {
        set({ isLoading: false, error: (err as Error).message });
        throw err;
      }
    },

    // blackjack-app-spec.md section 5b: Leave Table is available anytime,
    // including mid-hand, via a confirmation sheet. If a hand is currently in
    // progress (playerTurn/insurance/dealerTurn — anything mid-round), every
    // one of the active game's player hands is forfeited as a loss first
    // (bet forfeited, no payout) — including any already-finished-but-not-
    // yet-settled split hand, not just the currently active one — before
    // closing the session via the existing leaveTable(). No dealer reveal or
    // playDealerTurn() call: the round is being abandoned, not played out, so
    // the dealer's hand is recorded exactly as it stands (whatever's already
    // known) rather than resolved further. Between rounds (screenPhase is
    // 'betting', 'waiting', 'settlement', 'buyInSheet', or 'idle' — no
    // unsettled hand exists), this just calls leaveTable() directly, no
    // forfeiture step. 'waiting' (Cancel Bet's idle state, section 5b) is
    // double-guarded here: it's absent from midRoundPhases below, AND game
    // is always null while screenPhase is 'waiting' (cancelBet only fires
    // from 'betting', where game is already null — no round has been dealt
    // yet), so the `isMidRound && game && ...` check below no-ops on both
    // counts. Verified, not assumed — no forfeiture-bypass logic needed.
    confirmLeaveTable: async () => {
      const { screenPhase, game, session, inPlay } = get();
      const midRoundPhases: ScreenPhase[] = ['playerTurn', 'insurance', 'dealerTurn'];
      const isMidRound = midRoundPhases.includes(screenPhase);

      if (isMidRound && game && session && inPlay !== null) {
        set({ isLoading: true, error: null });
        try {
          const db = await getDatabase();
          const dealerFinalScore = calculateScore(game.dealerHand).score;

          let runningInPlay = inPlay;
          for (const hand of game.playerHands) {
            runningInPlay -= hand.bet;
            const handData: HandData = {
              betAmount: hand.bet,
              result: hand.isBusted ? 'bust' : 'lose',
              playerFinalScore: calculateScore(hand.cards).score,
              dealerFinalScore,
              inPlayAfter: runningInPlay,
            };
            await insertHand(db, session.id, handData);
          }

          set({
            inPlay: runningInPlay,
            game: null,
            dealer: null,
            playerHands: [],
            resultQueue: [],
            isLoading: false,
          });
        } catch (err) {
          set({ isLoading: false, error: (err as Error).message });
          throw err;
        }
      }

      await get().leaveTable();
    },

    // DEV/QA-ONLY. Bypasses debitForBuyIn/creditFromLeaveTable entirely —
    // this is not a real gameplay action, it exists purely so manual device
    // testing can top the wallet back up without reinstalling the app.
    // Remove or gate this before Phase 8 (packaging) — don't let it quietly
    // become a real feature.
    resetBalanceForTesting: async (amount: number = 10000) => {
      set({ isLoading: true, error: null });
      try {
        const db = await getDatabase();
        const balance = await devResetBalance(db, amount);
        set({ balance, isLoading: false });
      } catch (err) {
        set({ isLoading: false, error: (err as Error).message });
      }
    },
  };
});
