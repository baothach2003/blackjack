# Blackjack App — Project Instructions

Persistent context for Codex. Read this fully before starting any task in this repo.

## 1. What this project is

A single-player blackjack game against a rule-based dealer, built with React Native +
Expo, targeting iOS and Android from one codebase. Portfolio-grade project — built to
production quality, not a throwaway demo.

**No multiplayer, no real money, no login/cloud account.** These are permanently
out of scope, not deferred — see section 3 for what that means for architecture.

Full rules and scoring logic: `docs/blackjack-game-logic.md`. Full phase-by-phase plan:
`docs/project-plan.md`. Full screen-by-screen UX behavior: `docs/blackjack-app-spec.md`
Original per-screen design generation prompts (useful for animation/motion
detail not always repeated elsewhere): `docs/figma-design-prompts.md`.
(source of truth for what each screen does, not just what it looks like — read this
before implementing any screen). Raw design values: `docs/design-tokens.md`. This file
(AGENTS.md) is the condensed, always-loaded summary of the decisions in those
documents — if something here ever conflicts with them, treat it as a signal to stop
and reconcile, not to silently pick one.

**Balance vs. In-Play — do not conflate these two numbers:**
- **Balance** — the player's total wallet across the whole app, shown in headers.
- **In-Play** — the amount currently bought into the active table session (a subset
  of Balance, set via the Buy-in screen). Only exists while a session is active.

See `docs/blackjack-app-spec.md` sections 1 and 3.2-3.4 for the full Buy-in flow
(initial buy-in, mid-game re-buy when In-Play hits 0, "Leave The Table" cash-out).

## 2. Tech stack (do not deviate without asking)

- **Framework:** React Native via Expo (managed workflow)
- **Language:** TypeScript required everywhere — no plain `.js` files
- **State management:** Zustand only — never Redux, MobX, or Context-as-global-state
- **Local persistence:** `expo-sqlite` — never AsyncStorage for anything that needs
  aggregation (stats), never a cloud database
- **Animation:** `react-native-reanimated` (requires `react-native-worklets` as an
  explicit peer dependency on this project's pinned versions — it does NOT get
  installed automatically as a transitive dependency; if a fresh `npm install`
  reports reanimated errors, install it explicitly: `npx expo install
  react-native-worklets`)
- **Sound:** `expo-av`
- **Testing:** Jest, for `src/game/` and `src/storage/` unit tests
- **No backend, no REST API, no cloud service of any kind.** The app is fully offline.
  Do not add Firebase, Supabase, Postgres, or any network call unless explicitly
  instructed — this would contradict the local-only decision in section 1.

## 3. Architecture decisions (already made — do not re-litigate)

### 3.1 `src/game/` is pure logic, zero React dependency
This is the single most important rule in this codebase. `src/game/` must never
import anything from `react` or `react-native`. It contains:
- `deck.ts` — deck creation, Fisher-Yates shuffle
- `scoring.ts` — `calculateScore`, `isBust`, `isNaturalBlackjack` (flexible Ace logic —
  see `docs/blackjack-game-logic.md` section 6 for the exact algorithm, don't reinvent it)
- `rules.ts` — dealer rules (hit below 17, stand at 17+, `dealerHitsSoftSeventeen`
  config toggle)
- `gameEngine.ts` — orchestrates a round: betting → dealing → playerTurn → dealerTurn →
  settlement, handles hit/stand/double/split, calls `resolveOutcome`

Every function here must be independently testable with Jest, no widget/component
rendering involved. If a PR adds logic here and imports anything from `react-native`,
that's a review blocker, not a style nitpick.

### 3.2 `src/storage/` is separate from `src/game/`, also React-free where possible
Local SQLite persistence via `expo-sqlite`. Contains:
- `db.ts` — database setup and migrations
- `walletRepository.ts` — get/update Balance (the app-wide total, outside any session)
- `sessionsRepository.ts` — start/end a table session (Buy-in), track In-Play
- `handsRepository.ts` — insert a completed hand, query stats

Schema:
```
wallet (
  id,                    -- singleton row, always id=1
  balance                -- the app-wide Balance shown in headers
)

sessions (
  id, started_at, buy_in_amount, ended_at, ending_in_play
)

hands (
  id, session_id (FK -> sessions.id), played_at, bet_amount,
  result (win/lose/push/blackjack/bust), player_final_score, dealer_final_score,
  in_play_after            -- In-Play balance right after this hand settles
)
```

Balance only changes on: Buy-in (debit Balance, credit a new session's In-Play) and
Leave The Table (credit remaining In-Play back to Balance, close the session). Hit/
Stand never touch Balance directly — they only affect the current session's In-Play,
via the `hands` table.

All Profile/Stats numbers (win rate, hands played, longest win streak, natural
blackjack rate, biggest win) are **derived via SQL query from `hands`** — never
maintained as separate running counters that can drift out of sync with the source
data. If a new stat is needed, write a new query, don't add a new column that
duplicates derivable data.

### 3.3 `src/store/` is the only layer allowed to know about both `game/` and `storage/`
Components in `screens/` and `components/` call into `gameStore.ts` (Zustand), never
directly into `gameEngine.ts` or `handsRepository.ts`. This keeps each layer
independently testable and swappable. If you're writing a component and reaching for
an import from `src/game/` or `src/storage/` directly, stop — go through the store.

### 3.4 Why no abstraction layer for "future multiplayer"
Earlier drafts of this project considered a network-ready abstraction (a `GameSource`
interface) to ease a hypothetical future multiplayer mode. **That is no longer the
plan.** Multiplayer is permanently out of scope (see `docs/project-plan.md` section 1).
Do not add speculative abstraction layers for it — keep `gameStore.ts` talking to
`gameEngine.ts` directly. Building for an imagined future here is wasted complexity.

## 4. Folder structure

```
blackjack-app/
├── AGENTS.md
├── README.md
├── app.json
├── package.json
├── docs/
│   ├── blackjack-game-logic.md # full rules & scoring spec — source of truth
│   ├── project-plan.md        # phase-by-phase roadmap
│   ├── blackjack-app-spec.md  # screen-by-screen UX behavior — source of truth
│   └── design-tokens.md       # colors, fonts, spacing — see section 6
│   └── figma-design-prompts.md # original Figma generation prompts — motion/animation detail
├── design/
│   ├── mockups/                 # PNG exports from Figma "Screens" page — actual
│   │   │                        # filenames as exported, Title Case, spaces/dashes
│   │   │                        # kept as-is rather than forcing a rename
│   │   ├── Home.png
│   │   ├── Buy-in.png
│   │   ├── Buy-in Sheet (Mid-game).png
│   │   ├── Place Bet Sheet.png
│   │   ├── Gameplay.png
│   │   ├── Split Hands.png
│   │   ├── Split Hands - 3 Hands (Scroll).png
│   │   ├── Multi-Card Hand (Overlap).png
│   │   ├── Hit Animation - Before.png
│   │   ├── Hit Animation - After.png
│   │   ├── Result - Win.png
│   │   ├── Result - Push.png
│   │   ├── Result - Lose.png
│   │   ├── Result - Bust.png
│   │   ├── Result - Blackjack.png
│   │   ├── Profile.png           # NOT "stats.png" — see section 7, canonical name is Profile
│   │   ├── Settings.png
│   │   └── Shop.png
│   └── figma-link.txt
├── assets/                     # bundled into the app at build time
│   ├── cards/                  # 52 card faces + card back, CLEAN names (2H.png,
│   │                            # KS.png, back.png — not raw Figma export names,
│   │                            # see section 8 for the required rename step)
│   ├── sounds/                 # deal.mp3, win.mp3, lose.mp3, etc.
│   └── icons/
├── src/
│   ├── game/                   # pure logic — see 3.1
│   ├── storage/                # local persistence — see 3.2
│   ├── store/                  # Zustand bridge — see 3.3
│   │   └── gameStore.ts
│   ├── components/
│   │   ├── Card.tsx
│   │   ├── Chip.tsx
│   │   ├── ActionButtons.tsx
│   │   ├── DealerArea.tsx
│   │   ├── PlayerHand.tsx
│   │   └── ResultOverlay.tsx
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── BuyInScreen.tsx
│   │   ├── GameplayScreen.tsx    # includes Buy-in Sheet (mid-game) + Place Bet Sheet
│   │   ├── ProfileScreen.tsx     # NOT "StatsScreen" — matches design's "Profile" naming
│   │   ├── SettingsScreen.tsx
│   │   └── ShopScreen.tsx
│   └── hooks/
│       └── useGameState.ts
└── .github/
    └── workflows/
        └── ci.yml              # lint + test on every PR
```

`docs/` and `design/` are reference material — Codex should read/view them,
never treat them as buildable source. `assets/` is real app content that ships with
the build — anything placed here must be production-quality, not a placeholder.

## 5. Coding conventions

- File names: components use `PascalCase.tsx` (`Card.tsx`); plain logic/util files use
  `camelCase.ts` (`gameEngine.ts`)
- Component/class names: `PascalCase`
- One major component per file; split a file once it exceeds ~300 lines
- Every new function in `src/game/` or `src/storage/` needs a unit test in the same PR
  — not added later
- Prefer function components + hooks; no class components
- Comments explain *why*, not *what* — don't narrate obvious code
- Use `StyleSheet.absoluteFillObject`, never `StyleSheet.absoluteFill`, when
  spreading into a style array (e.g. `[styles.backdrop, StyleSheet.absoluteFillObject]`)
  — on this project's pinned RN version, `absoluteFill` is typed as an opaque
  `RegisteredStyle` and isn't spreadable; only `absoluteFillObject` is the plain
  spreadable object form.

## 6. Design tokens

> Full raw value table: `docs/design-tokens.md`. Values below are the condensed
> quick-reference copy — if the two ever disagree, `docs/design-tokens.md` wins and
> this section should be corrected to match.

- Background: `#0D0D0F` (near-black) · Elevated surfaces: `#17171A`
- Primary text: `#F5F5F5` · Secondary/muted text: `#8E8E93`
- Accent (emerald green): `#2ECC71` · Accent pressed: `#27AE60` · Accent-on (text on accent fill): `#0D0D0F`
- Negative/warning (loss, bust): `#E74C3C`
- Border: `#2A2A2E`
- Card face background: `#FAFAFA` · Card back background: `#0B0B0E`
- Suit colors: red (hearts/diamonds) `#E74C3C` · black (clubs/spades) `#1A1A1A`
- Disabled button: bg `#222225`, text `#5A5A5E`
- Font family: **Inter**
- Type scale: Hero Number 64px/Light · H1 28px/Bold · H2 20px/SemiBold · Body 16px/Regular · Caption 13px/Medium
- Spacing scale: `8 / 16 / 24 / 32` px
- Corner radius: card/panel `20px` · pill button `999px` (full round) · chip/badge `8px` · playing card `12px`
- Card elevation shadow: `#000` @ 35% opacity, Y-offset 8, blur 24

Playing card base size is 140×196px — always scale instances uniformly (never
stretch width/height independently) or suit/rank glyphs distort. Always check the
matching PNG in `design/mockups/` before building a screen — don't rely on verbal
description alone.

## 7. Screens (v1.0 — per `docs/blackjack-app-spec.md`, the authoritative source)

| Screen | Purpose |
|---|---|
| HomeScreen | Balance (Hero Number), "Blackjack" CTA card, Top Balances (static/seed leaderboard, cosmetic only) |
| BuyInScreen | Choose chip amount to bring to the table; deducts from Balance, sets In-Play |
| GameplayScreen | Core play loop: Place Bet Sheet each round, dealer/player cards, Hit/Stand/Double/Split, Buy-in Sheet (mid-game) when In-Play hits 0, Result overlay |
| ProfileScreen | Avatar, username, "Card backs"/"Rank progress" cards, Statistics — exactly 4 stat cards per `blackjack-app-spec.md` §3.11 and the `Profile.png` mockup: Win Rate, Biggest Win, Hands Played, Blackjacks Hit (a count, not a rate) — all queried from `handsRepository`. Note: named ProfileScreen, not StatsScreen — matches the design's bottom-nav label ("Profile") and the actual Figma frame name (`Blackjack / Profile`). `handsRepository` also exports `getLongestWinStreak`/`getNaturalBlackjackRate` (built and tested in Phase 1b) which are NOT currently rendered anywhere — live, correct, unused code, kept in case a 5th stat card is added later (see project-plan.md Backlog). Don't delete them without checking there first. |(`Blackjack / Profile`). |
| SettingsScreen | Player name (local only — no "Sign out", this app has no accounts), sound, vibration, how to play, reset stats, restore purchases, privacy, credits |
| ShopScreen | Chip packages (mocked IAP) |

Full behavior detail (Buy-in flow, Result overlay states, Balance vs. In-Play rules)
is in `docs/blackjack-app-spec.md` — this table is just an index, not the spec itself.

## 8. Asset filename hygiene (required before Phase 3)

Card images exported from Figma keep Figma's raw variant naming (e.g.
`Rank=10, Suit=Clubs@3x.png`, `Rank=Back, Suit=Back@3x.png`) — commas, spaces, and an
`@3x` suffix, unusable as clean `require()` keys in a Card lookup map. Before any
component reads from `assets/cards/`, rename all 53 files to a clean convention:
rank (`2`-`9`, `T` for 10, `J`, `Q`, `K`, `A`) + suit initial (`H`/`D`/`C`/`S`), e.g.
`2H.png`, `TC.png`, `KS.png`, `AH.png`, and `back.png` for the face-down variant.
Write this as a small one-time script (not a manual per-file rename) so it's
reproducible if the Figma export is regenerated later.

## 9. What NOT to do

- Do not add any backend, API client, cloud database, or network dependency.
- Do not introduce a new state management library (Redux, MobX, Context-as-store).
- Do not import `react` or `react-native` inside `src/game/`.
- Do not call `gameEngine.ts` or `handsRepository.ts` directly from a component —
  always go through `gameStore.ts`.
- Do not invent design tokens — check section 6 / `docs/design-tokens.md`, or ask.
- Do not build speculative multiplayer scaffolding "just in case" — see 3.4.
- Do not maintain duplicate/derived stat counters outside the `hands` table.
- Do not add a "Sign out" row to Settings — this app has no login/account system.
  If `docs/blackjack-app-spec.md` still shows one (leftover from the poker reference
  it was adapted from), that row is explicitly excluded — don't implement it.
- Do not conflate Balance and In-Play (see section 1) — Hit/Stand/Double/Split only
  affect the active session's In-Play; only Buy-in and Leave The Table touch Balance.
- Do not commit any secret or `.env` file — this project has none and should stay
  that way given the local-only, no-backend decision.

## 10. Definition of Done (per feature)

A feature is done when:
1. Unit tests pass for any logic touched in `src/game/` or `src/storage/`.
2. Manually verified via Expo Go on both an iOS and an Android device (or at least
   one of each if only one platform is available at the time).
3. No new ESLint warnings.
4. If it touches the `hands` table, a query confirms stats compute correctly and
   survive an app restart.

## 11. Commands

```bash
npm install                 # install deps
npx expo start               # run dev server, scan QR with Expo Go
npm test                     # run Jest unit tests
npx eslint src/              # lint
```

---
*This file is a living document. Update it when architecture decisions change — see
section 3.4 for an example of a decision that was reversed and documented here rather
than left stale.*
