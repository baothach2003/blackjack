# Blackjack App — Project Plan (v1.2 — updated)

Prepared by: Dev Lead
Project goal: build a complete mobile blackjack app (React Native/Expo), UI inspired by the vertical, minimal layout style of Offsuit, with full game logic, animation, sound, Buy-in/Balance flow, and local statistics tracking. Full screen-by-screen behavior is the source of truth in `docs/blackjack-app-spec.md` — this plan indexes phases and tasks, it doesn't restate every UX detail. Distribution target: TBD — confirm before Phase 8 whether this is portfolio-demo-only or will also be shared with friends for real device testing (affects whether TestFlight/Firebase App Distribution setup is needed).

Team assumption: 4 roles — Game Logic Dev, UI/UX Designer, Frontend/Mobile Dev, QA/Integration. If your team is smaller, one person can cover two roles (Frontend + QA is the most common combo). All phase ownership below still applies even when one person covers multiple roles — treat each "Owner" line as a checklist of hats to wear, not a literal headcount requirement.

---

## 1. Scope

### In-scope
- Single-player blackjack against a rule-based dealer (not machine-learning AI, just fixed dealer rules).
- Full actions: hit, stand, double down, split, insurance (offered when the dealer's up-card is an Ace).
- **Buy-in flow**: a "Buy-in" screen where the player chooses a chip amount to bring into a table session (In-Play), separate from their app-wide Balance. Mid-session, if In-Play reaches 0, a Buy-in Sheet offers re-buy or "Leave The Table" (cashing remaining In-Play back to Balance). See `docs/blackjack-app-spec.md` for full behavior.
- One table type only, no multiplayer, no real-money play.
- Virtual chips only, no real payment system.
- **"Top Balances" leaderboard on Home**: cosmetic/flavor only, using static or seed data — not a live ranking against other real users (this app has no multiplayer/backend to source that from).
- Basic animation: dealing, card flip, chip movement.
- Basic sound: card flip, win/lose, chip placement.
- **Local statistics tracking**: every completed hand is saved on-device (win/lose/push/blackjack/bust, bet amount, final scores, In-Play balance after). Used to compute a Profile/Stats screen (win rate, hands played, longest win streak, natural blackjack rate, biggest win). This is local device storage only — no server, no account required to use it.
- Runs on iOS and Android via Expo.

### Out-of-scope (to prevent scope creep)
- Multiplayer / playing against other real players.
- Account system, login, **cloud** storage or cross-device sync. (Local on-device storage for stats is in-scope — see above. Don't conflate the two.)
- Real chip purchases or any form of real-money gambling.
- Multi-language support, multiple themes.
- Other table games (poker, baccarat, etc.).

Any new idea that comes up outside this list should go into the "Backlog / Phase 2" section instead of being inserted into the current scope.

---

## 2. Tech Stack

- Framework: React Native via Expo (managed workflow).
- Language: TypeScript required, no plain JS.
- State management: Zustand.
- **Local persistence: `expo-sqlite`** (structured queries needed for stats aggregation — e.g. "longest win streak" — which plain AsyncStorage key-value storage can't do cleanly).
- Animation: react-native-reanimated.
- Sound: expo-av.
- Testing: Jest for game logic unit tests.
- Source control: Git, single shared repo, feature branches (`feature/game-logic`, `feature/ui-table`, `feature/stats-db`, etc.), merged via pull request with at least one reviewer.

---

## 3. Initial Setup (applies to the whole team)

Each member should prepare their machine before starting Phase 0:

1. Install Node.js LTS.
2. Install Expo CLI: `npm install -g expo-cli` (or just use `npx expo` directly, no global install needed).
3. Install Expo Go on a personal phone (iOS/Android) for direct testing; no need to install Xcode/Android Studio at this stage.
4. Clone the shared repo, run `npm install`, then `npx expo start` to confirm the project runs locally.
5. Install ESLint + Prettier extensions in the editor, synced to the shared config file in the repo to avoid formatting mismatches across machines.

The Dev Lead is responsible for initializing the repo, setting up the folder structure (see section 4), and inviting team members before Phase 1 begins.

---

## 4. Shared Folder Structure

```
src/
  game/          // owned by Game Logic Dev
    deck.ts
    scoring.ts
    rules.ts
    gameEngine.ts
    __tests__/
  storage/       // local persistence — owned by Game Logic Dev or Frontend Dev
    db.ts                    // expo-sqlite setup + migrations
    walletRepository.ts       // get/update app-wide Balance
    sessionsRepository.ts     // start/end a Buy-in session, track In-Play
    handsRepository.ts        // insert completed hand, query stats
    __tests__/
  components/    // owned by Frontend Dev, based on UI/UX design
    Card.tsx
    Chip.tsx
    ActionButtons.tsx
    DealerArea.tsx
    PlayerHand.tsx
    ResultOverlay.tsx
  screens/
    HomeScreen.tsx
    BuyInScreen.tsx
    GameplayScreen.tsx       // includes Buy-in Sheet (mid-game) + Place Bet Sheet
    ProfileScreen.tsx         // profile/statistics screen
    SettingsScreen.tsx
    ShopScreen.tsx
  hooks/
    useGameState.ts
  assets/
    cards/  sounds/  icons/
  store/
    gameStore.ts   // Zustand store
```

Non-negotiable rule: the `game/` folder must never import anything from React or React Native. This is a pure logic layer that must be independently testable with Jest, with no UI rendering involved. This is the most important architectural principle — anyone who violates it during code review will be asked to fix it.

The `storage/` folder should also stay React-free where possible (plain functions that take/return data), so it can be unit tested the same way as `game/`.

---

## 5. Phases

### Phase 0 — Preparation (half a day)
Dev Lead initializes the repo, sets up the folder structure, configures ESLint/Prettier, and writes a setup README. The whole team follows section 3 to confirm their environment works.

Deliverable: repo runs with `npx expo start` and shows the default screen on every team member's phone.

### Phase 1 — Game Logic (no UI involved)
Owner: Game Logic Dev. No one else needs to wait on this — Phase 2 (UI design) can run in parallel since the two are independent.

Tasks:
- Write deck creation and shuffle functions (Fisher-Yates).
- Write the scoring function that handles flexible Ace values (per the existing spec in `blackjack-game-logic.md`).
- Write dealer rules (hit below 17, stand at 17+, with a toggle config for hitting soft 17).
- Implement hit/stand/double/split action handling.
- Write the outcome resolution function (win/lose/push/blackjack).
- Write unit tests for all of the above, especially edge cases: multiple Aces, soft 17, both sides having a natural blackjack simultaneously.

Deliverable: everything in `src/game/` has 100% passing tests with zero React dependency.

### Phase 1b — Local Persistence Layer (can run in parallel with Phase 1)
Owner: Game Logic Dev or Frontend Dev.

Tasks:
- Set up `expo-sqlite` with three tables: `wallet` (singleton row holding the app-wide Balance), `sessions` (one row per Buy-in session: buy_in_amount, ending_in_play), and `hands` (id, session_id FK, played_at, bet_amount, result, player_final_score, dealer_final_score, in_play_after).
- Write `walletRepository.ts` (get/update Balance), `sessionsRepository.ts` (start/end a session), and `handsRepository.ts` (insert a completed hand, query functions for each stat needed by the Stats screen: win rate, hands played, longest win streak, natural blackjack rate, biggest win).
- Unit test all three repositories against an in-memory/test database, including the Balance/In-Play transfer logic on Buy-in and Leave The Table.

Deliverable: can simulate a full session (buy-in → a few hands → leave table) and correctly query back Balance, In-Play, and all stats listed above, with no UI involved yet.

### Phase 2 — UX/UI Design (runs in parallel with Phase 1)
Owner: UI/UX Designer, coordinating with the Frontend Dev to confirm technical feasibility.

Tasks:
- Wireframe all 6 screens: Home (Balance, "Blackjack" CTA, Top Balances flavor list), Buy-in (chip amount slider/stepper), Gameplay (dealer/player cards, Place Bet Sheet, action buttons, Buy-in Sheet for mid-game re-buy, Result overlay), Stats/Profile, Settings, and Shop.
- Vertical layout, dealer on top, player at the bottom, action buttons within thumb reach at the bottom, minimal and ad-free, following the Offsuit-inspired direction discussed earlier.
- Define design tokens: color palette, typography, spacing scale, corner radius, so the Frontend Dev codes against a system rather than eyeballing values.
- Design each action button's states: enabled, disabled (e.g. double only enabled when eligible), pressed. Design the contextual button swaps: Insurance Yes/No (when dealer shows an Ace) and Split/Don't Split (when eligible) temporarily replace Hit/Stand/Double.
- Define the animation flow at a conceptual level: where cards deal from and to, which direction they flip, how chips move. No need to build real animation, just describe it clearly enough for the Frontend Dev to implement with Reanimated.
- Select or design the card asset set (52-card component with rank/suit variants) and chip icons.

Deliverable: a Figma file with all 6 screens, design tokens, and animation flow annotations — recorded as `docs/blackjack-app-spec.md` alongside the Figma file itself, so intent isn't lost to the mockups alone.

### Phase 3 — Static UI (no logic, no animation yet)
Owner: Frontend Dev, based on the Phase 2 design.

Tasks:
- Build the GameplayScreen layout matching the wireframe, using mock data (all states: betting, player turn, insurance, split, dealer turn, result).
- Build HomeScreen, BuyInScreen, ProfileScreen, SettingsScreen, ShopScreen layouts using mock data.
- Card, Chip, ActionButtons, DealerArea, PlayerHand, ResultOverlay components, all receiving static props, not yet wired to real state.
- Ensure responsiveness across common screen sizes (test on at least one small and one large device).

Deliverable: running the app shows the correct static UI matching the design for all 6 screens; nothing is interactive yet.

### Phase 4 — Wire UI to Game Logic
Owner: Frontend Dev, working closely with the Game Logic Dev to confirm the interface between the two layers.

Tasks:
- Set up the Zustand store (`gameStore.ts`) as the bridge between `gameEngine.ts`, the three repositories (Phase 1b), and the UI.
- Wire BuyInScreen to `sessionsRepository`: debit Balance, create a session, set In-Play.
- Connect action buttons to the real game engine, removing mock data.
- Display real-time score updates after each action.
- Correctly handle all outcome flows: regular win, blackjack win (3:2 payout), loss, push, bust — each writes a row to `hands` and updates In-Play (never Balance directly).
- Handle the split flow with multiple hands displayed in parallel, stacked vertically, with dimmed styling on inactive/finished/busted hands.
- Wire the mid-game Buy-in Sheet (triggers when In-Play hits 0) and "Leave The Table" (credits remaining In-Play back to Balance, closes the session).
- Wire ProfileScreen to real queries from `handsRepository`, removing mock data.

Deliverable: a full session can be played start to finish — buy in, play several hands including a split and a mid-game re-buy, leave the table — with Balance/In-Play staying correct throughout, no animation/sound yet.

### Phase 5 — Animation
Owner: Frontend Dev.

Tasks:
- Dealing animation (movement from the deck position to the player/dealer position).
- Card flip animation (dealer's hole card flips up when it's the dealer's turn).
- Chip movement animation for placing bets and paying out winnings.
- Start with simple animations (fade, slide, scale) before attempting more complex ones (3D flip), which can come later if time permits.

Deliverable: smooth animation on real devices, no jank, matching the annotations from the UI/UX Designer in Phase 2.

### Phase 6 — Sound
Owner: Frontend Dev, coordinating with the UI/UX Designer to pick sound assets that match the visual tone.

Tasks:
- Integrate expo-av.
- Add sound effects: dealing, card flip, chip placement, win, lose, blackjack.
- Add a global mute/unmute toggle.

Deliverable: sound triggers at the correct moment, no delay, no overlapping when actions happen in quick succession.

### Phase 7 — QA & Polish
Owner: QA/Integration, with the whole team fixing bugs in their respective areas.

Tasks:
- Test all edge cases: split then double, dealer bust, push, consecutive multiple Aces, running out of chips.
- Test on at least 2 different real devices (1 iOS, 1 Android if available).
- Verify stats stay correct after app restart (data survives closing/reopening the app) and after edge-case rounds (split hands, pushes).
- Review the UI against the original design, fix spacing/color mismatches.
- Review the full codebase, remove dead code, confirm `src/game/` and `src/storage/` are still clean of any unnecessary React dependency.

Deliverable: app runs stably and is ready for a demo recording.

### Phase 8 — Packaging & Distribution
Owner: Dev Lead.

**Before starting this phase, confirm the distribution goal** (currently unresolved — pick one):
- Portfolio-only: build an APK/IPA once for screen recording, no ongoing distribution needed.
- Friend testing: set up Firebase App Distribution (Android) and/or TestFlight (iOS, requires Apple Developer Program, $99/year) for ongoing test builds.

Tasks:
- Build per the confirmed distribution goal above.
- Write the README: architecture, rationale for tech choices, local setup instructions, screenshots/GIF demo.
- Clearly document each member's contribution if this is used as a shared team portfolio piece.

Deliverable: a complete repo, a full README, and either a demo video/GIF or a working distribution channel, depending on the confirmed goal.

---

## 6. Working Principles

- Every feature is built on its own branch, never pushed directly to main.
- Every pull request needs at least one reviewer before merging; prioritize cross-review between the Frontend Dev and Game Logic Dev to keep the interface between the two layers in sync.
- Before starting each new phase, hold a quick 10-15 minute sync to confirm the previous phase's deliverable is met, to avoid building the next phase on an unstable foundation.
- Any idea that comes up outside the scope in section 1 goes into the Backlog, not added mid-stream.

---

## 7. Backlog / Phase 2 (later, if time allows)

- Surrender.
- Multiple decks (6-8 decks) with a configurable card-counting test mode.
- Light/dark theme.
- Card-counting hints for educational purposes only (not intended to enable real cheating).
- Cloud sync of local stats (explicitly deferred — see section 1).
- Real data source for "Top Balances" if the flavor leaderboard is ever upgraded beyond static/seed data.
- A 5th Profile stat card for "Longest Win Streak" — `handsRepository.getLongestWinStreak` already exists and is tested (Phase 1b), just not currently wired to any UI, since the confirmed 4-card Profile design (blackjack-app-spec.md §3.11) doesn't include it.
- Session resume after a full app kill mid-session — `sessionsRepository.getCurrentInPlay` has a known gap here (can't reconstruct In-Play if a re-buy happened but no hand has been played/settled since), documented but not fixed since no current feature exercises this path.
