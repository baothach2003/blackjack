# Blackjack App — Project Instructions

Persistent context for Claude Code. Read this fully before starting any task in this repo.

## 1. What this project is

A single-player blackjack game against a rule-based dealer, built with React Native +
Expo, targeting iOS and Android from one codebase. Portfolio-grade project — built to
production quality, not a throwaway demo.

**No multiplayer, no real money, no login/cloud account.** These are permanently
out of scope, not deferred — see section 3 for what that means for architecture.

Where each fact lives (each fact in one file only; the others link to it):

| File | Holds |
|---|---|
| `docs/blackjack-game-logic.md` | Rules and scoring algorithm |
| `docs/blackjack-app-spec.md` | What each screen does (source of truth for behaviour; read before touching a screen) |
| `docs/adr/` | Why the key decisions were made, and what was rejected (house rules: ADR-0004) |
| `docs/project-plan.md` | Phases, Backlog, and **Current Status** (read it every session) |
| `CONSTRAINTS.md` | The quality gates every session must pass |
| `docs/audit/` | Audit findings, triaged |
| `docs/design-tokens.md` | Raw design values |
| `docs/figma-design-prompts.md` | Original design prompts (motion detail not repeated elsewhere) |
| `SESSION_PROMPT.md` | The prompt Thach pastes to start each session |

This file (CLAUDE.md) is the condensed, always-loaded summary. If it ever
conflicts with one of the files above, stop and reconcile with Thach, never
silently pick one. `AGENTS.md` only points here, so there is one copy of the
rules.

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
rendering involved. The layer rules in 3.1-3.3 are enforced by
`src/__tests__/architecture.test.ts` (ADR-0002): a forbidden import fails
`npx jest`. Never relax that test to make a build pass (`CONSTRAINTS.md` F3).

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

Balance only changes on: Buy-in (debit Balance, credit a new session's In-Play),
mid-game re-buy (debit Balance, add to the same session's In-Play) and Leave The
Table (credit remaining In-Play back to Balance, close the session). Hit/Stand/
Double/Split never touch Balance directly — they only affect the current session's
In-Play, via the `hands` table. **In-Play is never negative**: a double or split is
allowed only if In-Play covers every chip at risk (ADR-0003).

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
├── CLAUDE.md                  # this file (AGENTS.md only points here)
├── CONSTRAINTS.md             # quality gates, checked every session
├── SESSION_PROMPT.md          # the prompt that starts each session
├── README.md  app.json  package.json  tsconfig.json  eslint.config.js
├── docs/
│   ├── blackjack-game-logic.md   # rules & scoring — source of truth
│   ├── blackjack-app-spec.md     # screen behaviour — source of truth
│   ├── project-plan.md           # phases, Backlog, Current Status
│   ├── design-tokens.md          # colors, fonts, spacing — see section 6
│   ├── figma-design-prompts.md   # original Figma prompts — motion detail
│   ├── SKILLS.md                 # which agent skills are installed and why
│   ├── adr/                      # decision records (README.md indexes them)
│   └── audit/                    # dated audit reports with triaged findings
├── design/
│   ├── mockups/               # PNG exports from Figma, exported names kept
│   │                          # (Title Case with spaces): Home.png,
│   │                          # Buy-in.png, Gameplay.png, Profile.png,
│   │                          # Split Hands*.png, Result - *.png (pre
│   │                          # ADR-0005, kept for reference) ...
│   └── figma-link.txt
├── assets/                    # bundled into the app at build time
│   ├── cards/                 # 2H.png ... AS.png, TC = ten, back.png
│   ├── sounds/                # Phase 6
│   └── icons/
├── scripts/rename-cards.js    # one-time Figma export -> clean card names
├── src/
│   ├── __tests__/architecture.test.ts   # enforces the layer rules
│   ├── game/                  # pure logic — 3.1
│   ├── storage/               # SQLite repositories — 3.2
│   ├── store/gameStore.ts     # the only bridge — 3.3
│   ├── theme/tokens.ts        # design tokens as constants
│   ├── components/            # ActionButtons, AnimatedNumber, Card, Chip,
│   │                          # DealerArea, DragSlider, PlayerHand
│   ├── screens/               # Home, BuyIn, Gameplay (incl. Place Bet,
│   │                          # Buy-in and Leave sheets), Profile,
│   │                          # Settings, Shop
│   └── navigation/            # RootNavigator + route types
└── .github/workflows/ci.yml   # tsc + lint + jest on push to main and on PRs
```

`docs/` and `design/` are reference material — read/view them, never treat them
as buildable source. `assets/` ships with the build — production quality only.

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
| GameplayScreen | Core play loop: Place Bet Sheet each round (with Cancel), dealer/player cards, Hit/Stand/Double plus an animated Split button (ADR-0006), Buy-in Sheet (mid-game) when In-Play hits 0, Leave Table confirmation. No result overlay: the In-Play number counts and pulses green/red (ADR-0005) |
| ProfileScreen | Avatar, username, "Card backs"/"Rank progress" cards, Statistics — exactly 4 stat cards per `blackjack-app-spec.md` §3.11 and the `Profile.png` mockup: Win Rate, Biggest Win, Hands Played, Blackjacks Hit (a count, not a rate) — all queried from `handsRepository`. Note: named ProfileScreen, not StatsScreen — matches the design's bottom-nav label ("Profile") and the actual Figma frame name (`Blackjack / Profile`). `handsRepository` also exports `getLongestWinStreak`/`getNaturalBlackjackRate` (built and tested in Phase 1b) which are NOT currently rendered anywhere — live, correct, unused code, kept in case a 5th stat card is added later (see project-plan.md Backlog). Don't delete them without checking there first. |
| SettingsScreen | Player name (local only — no "Sign out", this app has no accounts), sound, vibration, how to play, reset stats, restore purchases, privacy, credits |
| ShopScreen | Chip packages (mocked IAP) |

Full behavior detail (Buy-in flow, settlement feedback, Balance vs. In-Play rules)
is in `docs/blackjack-app-spec.md` — this table is just an index, not the spec itself.

## 8. Asset filenames

Card images use clean names: rank (`2`-`9`, `T` for 10, `J`, `Q`, `K`, `A`) + suit
initial (`H`/`D`/`C`/`S`), e.g. `TC.png`, plus `back.png`. If the Figma export is
regenerated, rerun `scripts/rename-cards.js`; never rename by hand.

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

## 10. Definition of Done (per session scope)

A scope is done when all of these hold:
1. Only the scope's items are implemented, nothing more.
2. Every Floor rule in `CONSTRAINTS.md` passes, with the real command output shown.
3. Every bug fix has a regression test that failed before the fix.
4. New logic in `src/game/`, `src/storage/` or `src/store/` has tests whose expected
   values were worked out by hand.
5. If it touches the `hands` table: a test shows the stats compute correctly.
6. On-device check list given to Thach; the item stays open until he confirms
   (Expo Go on iPhone; Android when available).
7. Current Status in `docs/project-plan.md` rewritten; decisions recorded (an ADR
   for anything section 12 calls a decision).
8. Key decisions explained to Thach in Vietnamese in chat; git commands proposed.

## 11. Commands

```bash
npm install                        # install deps
npx expo start                     # dev server; scan the QR with Expo Go
npx expo start -c                  # same, clearing Metro's cache
npx tsc --noEmit                   # type check (CONSTRAINTS F4)
npx eslint src/ --max-warnings=0   # lint (F5)
npx jest                           # all tests, incl. the architecture test (F1, F3)
```

## 12. How sessions work

- **One scope per session**, taken from `SESSION_PROMPT.md` or Current Status.
  Never start the next scope without Thach's approval.
- **Test-first for bugs.** Reproduce with a failing test, fix, show it passing.
- **Measure, don't guess.** When a fix "should work" but the device disagrees,
  add temporary instrumentation, get real numbers from Thach's device, then fix.
  Remove the instrumentation in the same scope (`CONSTRAINTS.md` F7).
- **Triage.** A finding blocks further work only if it gives a wrong money amount,
  a wrong hand outcome, or a stuck state, AND is reachable in normal play.
  Everything else is recorded (audit file or Backlog) and scheduled.
- **Stop and ask, never guess,** when a change needs a rule or product decision
  not in `docs/` or `docs/adr/`, would loosen `CONSTRAINTS.md`, or grows beyond the
  scope's files. A decision Thach makes becomes an ADR (or a section 5b line in the
  spec if it is UX detail that changes often), in the same session.
- **Device truth.** The agent cannot see the phone. Never claim a screen looks or
  feels right; list what Thach must check.
- **Language.** Explain to Thach in Vietnamese in chat. Every file, comment and
  commit message stays in English.
- **Git.** Never run `git commit` or `git push`. Propose the exact `git add` and
  `git commit -m "..."` commands; Thach runs them. Commit messages: `feat:`,
  `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- **Current Status stays short.** Overwrite it every session (under 25 lines).
  History goes in commits, ADRs and audit files, not in the plan.

## 13. Skills

Installed skills and why: `docs/SKILLS.md`. This file wins over any skill.

| Moment | Skill |
|---|---|
| Implementing anything | incremental-implementation + test-driven-development |
| A test fails, or the device disagrees with the code | debugging-and-error-recovery |
| Screens, animation, accessibility | frontend-ui-engineering |
| Money logic (payouts, Balance/In-Play, settlement, leaving the table) or a rule change | doubt-driven-development |

---
*Living document. When a decision changes, write a new ADR and update this summary
in the same session; never leave this file describing code that no longer exists.*
