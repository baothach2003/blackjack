# Blackjack App — Product & Design Specification

**Purpose of this document:** this is the single source of truth for what was designed and decided during the Figma design process. It exists so an AI coding assistant (or a human developer) can implement the app correctly without re-guessing intent from the Figma file alone. Figma shows *what things look like*; this document explains *what they mean and how they behave*.

Companion file: `design-tokens.md` (colors, type, spacing, radius — the raw values referenced throughout this doc).

Figma file: https://www.figma.com/design/ElDIkPtDRhBfujXXEvDFSY — page **"Screens"** (implementation screens) and page **"Design System"** (tokens + reusable components).

---

## 1. Product Overview

- Single-player Blackjack. The player plays against a **rule-based dealer** (no AI opponents, no other human players, no multiplayer of any kind).
- Virtual currency only — **no real money** is involved anywhere in the product.
- Visual direction: dark, minimal, high-contrast, casino-app aesthetic. Originally modeled on the poker app "Offsuit" for visual language (dark background, pill buttons, single accent color), then adapted specifically for Blackjack.
- Two currency-like numbers exist and must not be confused:
  - **Balance** — the player's total wallet/bankroll across the whole app (shown in headers, e.g. "1,240" or "81,478").
  - **In-Play** — the amount the player has bought into the *current table* with (shown only inside the gameplay screen). This is a subset of Balance, set during Buy-in.

---

## 2. Screen Inventory & Flow

```
Home
 └─ tap "Blackjack" card → Buy-in (initial)
                              └─ tap "Start Game" → Gameplay
                                                       ├─ each new round → Place Bet Sheet (bottom sheet) → Gameplay (betting resolved)
                                                       ├─ Hit / Stand / Double / Split → Gameplay (updated state)
                                                       ├─ round ends → Result overlay (Win / Push / Lose / Bust / Blackjack) → "Next Hand" → Place Bet Sheet
                                                       └─ if In-Play chips reach 0 → Buy-in Sheet (mid-game)
                                                                                        ├─ "Buy-in" → back to Gameplay with refreshed In-Play
                                                                                        └─ "Leave The Table" → back to Home

Bottom navigation (Shop / Home / Profile) is available from Home, Profile, Shop and Settings is one level deeper.
Settings is reached from the gear icon on Profile.
```

Frame names in Figma follow the pattern `Blackjack / <Screen Name>` so they can be matched programmatically.

---

## 3. Screen-by-Screen Detail

### 3.1 Home (`Blackjack / Home`)
**Purpose:** app entry point / lobby.

- Top bar: accent-colored dot + Balance number (top-left), notification bell icon (top-right, decorative placeholder — no notification system was designed).
- **Hero Number**: large Balance display (uses the `Hero Number` text style — this is the only screen that uses it).
- **"Blackjack" CTA card**: solid accent-colored panel, tapping it starts the Buy-in flow. Since there is only one game mode (no game-mode carousel like the poker reference had), this is a single static card, not a carousel.
- **"Top Balances"** section: a leaderboard-style list of players ranked by balance. This is **cosmetic/competitive flavor only** — since the app has no multiplayer, this list is either static seed data or a simple global ranking of all app users by balance, not a live opponent list. Exact data source is an open implementation question (see Section 6).
- Bottom nav: Shop / Home (active) / Profile icons.

### 3.2 Buy-in — initial (`Blackjack / Buy-in`)
**Purpose:** the player chooses how many chips to bring to the table before a game session starts. This replaces a more complex "Stakes" concept from the original poker reference — Blackjack only has one buy-in decision, no stakes tiers.

- Back arrow (top-left) → returns to Home.
- Balance number shown at top (so the player has context for how much they can afford).
- "Buy-in" label + large numeric value (the currently selected buy-in amount).
- A **slider** represented visually as a row of tick marks (short ticks = unselected amounts, one tall tick = current selection, reddish ticks = higher/riskier amounts near the top of the range). This is a **static visual mock** of a slider in Figma — in code this must be a real interactive slider/stepper control that updates the numeric value live as the user drags.
- "START GAME" button (accent-colored, uses the `Button/Pill` component) → deducts the chosen amount from Balance, sets In-Play to that amount, navigates to Gameplay.

### 3.3 Gameplay — main screen (`Blackjack / Gameplay`)
**Purpose:** the core screen where a hand is played. This is the screen most other overlays/sheets are layered on top of.

Top to bottom:
- Header: back arrow, "Blackjack" title, Balance chip (accent dot + amount, top-right).
- **Dealer Icon**: a minimalist outline-only illustration (person from behind, dealing over a table edge), stroke color = accent, no fill. Purely decorative/branding — represents "the dealer" without a literal avatar since there's no real person.
- **"DEALER"** label (caption style) + dealer's two cards + dealer's **visible total** (only counts the face-up card, since one dealer card is face-down until the player finishes their turn — standard Blackjack rule).
- **Player hand total** — a small number (originally the "YOU" label, replaced per explicit request) showing the **sum of the player's current hand's card values**. This updates every time a card is added. Layer name: `Player Hand Total`.
- **Player's cards** — two (or more, see Section 4) face-up card instances from the `Card/Playing Card` component.
- **"In-Play" panel** — shows label "In-Play" + the chip amount the player bought into the table with (see Section 1 for the Balance vs. In-Play distinction). This does **not** change on Hit/Stand; it only changes via Buy-in (add) or round settlement (win/lose adjusts it after a hand completes).
- **Action buttons**: Hit / Stand / Double, all instances of the `Button/Pill` Default variant with label text overridden. Their game-logic meaning:
  - **Hit** — draw one card into the current hand. Does **not** change the bet amount.
  - **Stand** — end the player's turn for the current hand; dealer then plays out their hand by fixed rules (dealer AI rule set, e.g. "hit until 17", was **not specified** during design — see Section 6).
  - **Double** — doubles the current bet, draws exactly one more card, and automatically ends the turn (standard "Double Down" rule). This was **not yet visually designed as a distinct state** (e.g. showing the bet increase) — flagged in Section 6.
  - Split is not a fourth button in the base layout; it is a state/variant of the gameplay screen (see 3.6/3.7) that should appear only when the player's first two cards share the same rank.

### 3.4 Buy-in Sheet — mid-game (`Blackjack / Buy-in Sheet (Mid-game)`)
**Purpose:** shown automatically when In-Play reaches 0 chips during a session (the player has nothing left to bet).

- Bottom sheet (rounded top corners, drag handle, slides up over the dimmed Gameplay screen).
- Title "Buy into game", subtitle showing current Balance ("You have X chips").
- Large numeric buy-in amount + tick-mark slider (same visual pattern as 3.2, same implementation note: must be a real slider in code).
- **"Buy-in"** button (accent, primary) — adds the chosen amount to In-Play, deducts from Balance, dismisses the sheet, resumes Gameplay.
- **"Leave The Table"** button — secondary style: outlined box (border only, no fill), muted/secondary text color, underlined text. Tapping it exits the table entirely and returns to Home. This is a deliberately de-emphasized action (visually quieter than Buy-in) but must still be a proper tappable button, not just floating text.

### 3.5 Place Bet Sheet (`Blackjack / Place Bet Sheet`)
**Purpose:** shown at the start of every new round (after the previous round's result is dismissed, before cards are dealt), so the player sets the wager for the upcoming hand.

- Same bottom-sheet visual pattern as 3.4.
- Title "Place your bet", subtitle shows current In-Play amount ("You have X in play").
- Large numeric bet amount + tick-mark slider (no min/max labels shown on the UI — the numeric value alone updates live as the slider is dragged).
- **"Place Bet"** button (accent) — confirms the wager, deducts it from In-Play (or holds it as "at risk" depending on how the dev implements settlement), dismisses the sheet, deals the next hand.

### 3.6 Split Hands — 2 hands (`Blackjack / Split Hands`)
**Purpose:** the gameplay screen's layout when the player has split their starting pair into two hands.

- Chosen layout approach: **side-by-side, scaled down (~60% card size)** — both hands are visible at the same time without scrolling, each in its own bordered column.
- Each hand column shows: a small label ("HAND 1" / "HAND 2"), its own mini hand-total number, and its own row of cards.
- The **active hand** (the one currently being played) is visually distinguished with an accent-colored border around its whole column and an accent-colored total number. The inactive hand's column has a faint/neutral border and is dimmed (~55% opacity) to deprioritize it.
- The Hit / Stand / Double button row is **shared** — it always acts on whichever hand is currently active. When the active hand finishes (Stand/Bust), the app should move focus (and the accent-border styling) to the next unfinished hand automatically.

### 3.7 Split Hands — 3+ hands, scrollable (`Blackjack / Split Hands - 3 Hands (Scroll)`)
**Purpose:** what happens if the player splits more than once, producing 3 or 4 hands.

- Same column design as 3.6, but the hands sit inside a **horizontally scrollable container** (`clipsContent = true`, `overflowDirection = HORIZONTAL` in Figma — in code this is a horizontal ScrollView / equivalent).
- Only ~2 hands (plus a partial "peek" of the next one, matching the same peek pattern used on the Home screen's card carousel concept) are visible at once; the user scrolls sideways to reach additional hands.
- **Open question:** the maximum number of times a player can re-split was **not specified** by the product owner during design — see Section 6. The Figma demo shows 3 hands as an illustrative example only, not a hard limit.

### 3.8 Multi-Card Hand — overlap ("fan") layout (`Blackjack / Multi-Card Hand (Overlap)`)
**Purpose:** what happens visually when a hand accumulates more than 2 cards via repeated Hits (very possible in Blackjack with many low cards).

- Cards are laid out in a **horizontal row with negative spacing**, so each new card overlaps the previous one and only a sliver of the earlier cards remains visible (like a fan of real playing cards). This applies to:
  - The normal (non-split) player hand row.
  - Each individual hand's card row inside a Split layout (3.6/3.7), using a smaller overlap offset since those cards are already scaled down.
- This pattern should be used **any time a hand has 3+ cards**, in place of the plain side-by-side layout used for exactly 2 cards.
- Reference spacing used in the Figma mock: `-50` (negative item spacing) for full-size cards (90px wide), `-35` for the 60%-scaled split-hand cards (70px wide). These are visual starting points, not strict production values.

### 3.9 Hit Animation demo (`Blackjack / Hit Animation - Before` → `Blackjack / Hit Animation - After`)
**Purpose:** a Figma-only prototype (Smart Animate) to preview the *feel* of a card being dealt when the player taps Hit. **This is not a production screen** — it exists purely so the designer/stakeholder could preview motion before handing off to engineering.

- Two frames with an identically-named layer (`Dealt Card`) in different states: in "Before" it sits at near-zero scale and 0 opacity at the dealer icon's position (the implied "source" of the card); in "After" it's at full scale, full opacity, positioned as the 3rd card in the player's hand.
- A prototype interaction (`ON_CLICK` on the Hit button → `SMART_ANIMATE`, 0.4s, ease-in-and-out) is wired between the two frames so pressing "Hit" in Figma's Present mode visually plays the card flying in from the dealer to the player's hand.
- **Implementation guidance for engineering:** replicate this as a real animation — the new card should animate in from roughly the dealer's position to its final position in the hand, ~400ms, ease-in-out. Exact timing/easing can be refined; the direction and duration are the important reference points.

### 3.10 Round Result overlays (`Blackjack / Result - Win`, `- Push`, `- Lose`, `- Bust`, `- Blackjack`)
**Purpose:** shown as a modal overlay on top of the (dimmed) Gameplay screen at the end of every round, before the next Place Bet sheet appears.

All five share one layout: a dimmed full-screen overlay (75% opacity background color) + a centered card containing an emoji, a title, a signed amount (colored to match the outcome), and a "Next Hand" button (`Button/Pill`, accent).

| State | Emoji | Title | Amount color | Meaning |
|---|---|---|---|---|
| Win | 🎉 | "You Win!" | accent (green) | Player's final hand beat the dealer's without busting. |
| Push | 🤝 | "Push" | secondary (gray) | Tie — player's hand total equals the dealer's. Bet is returned (amount shown as "+0"). |
| Lose | 😬 | "Dealer Wins" | negative (red) | Player stood, but the dealer's final hand beat theirs (player did not bust). |
| Bust | 💥 | "Bust!" | negative (red) | Player's hand total exceeded 21 — an **automatic loss that happens immediately on the Hit that causes it**, before the dealer even plays. This is why it's a distinct state from "Lose": it can occur mid-turn, not just after Stand. |
| Blackjack | ✨ | "Blackjack!" | accent (green) | Player's first two cards were an Ace + a 10-value card (natural 21). Traditionally pays a higher ratio than a normal win (the mock uses "+75" against a "+50" normal win as an illustrative 1.5x example — **the real payout ratio was not specified**, see Section 6). |

The border color of the result card matches the amount color (accent for Win/Blackjack, negative for Lose/Bust, secondary for Push), giving a quick color-coded read of the outcome even before reading the text.

### 3.11 Profile (`Blackjack / Profile`)
**Purpose:** player identity + stats. Adapted from a poker-app reference; anything specific to multiplayer poker play-style (a radar chart of "Aggressive/Loose/Tight/Passive", "Friends", "Emotes") was intentionally **removed** since it doesn't apply to solo Blackjack.

- Avatar (simple initial-letter circle placeholder, accent-colored ring, edit-pencil badge) + username.
- Two row-cards: "Card backs" (cosmetic collectible count, kept from the reference since cosmetics still make sense) and "Rank progress" (a leveling/rank system, kept but the specific rank name "Fish" was replaced with a generic "Rookie" placeholder — the actual rank ladder/naming was not designed).
- **Statistics section** — replaces the poker radar chart with four flat stat cards relevant to solo Blackjack:
  - **Win Rate** (percentage of hands won)
  - **Biggest Win** (largest single-hand payout, signed/colored accent)
  - **Hands Played** (lifetime count)
  - **Blackjacks Hit** (count of natural 21s)
- Bottom nav (Profile active).

### 3.12 Settings (`Blackjack / Settings`)
**Purpose:** direct adaptation of the reference settings screen — structurally unchanged since none of its content is multiplayer-specific.

Rows, top to bottom: Username (nav, shows current value — this is a local display name only, this app has no login/account system), Sound (toggle), Vibration (toggle), Send us an email (nav), Join our Discord (nav), Share the app (nav), Hand rankings (nav — useful reference screen for a card game, content not yet designed), Restore purchases (nav), Privacy (nav), Credits (nav). Footer shows app name/version placeholder "Blackjack 1.0.0" (the real product name was never finalized — see Section 6).

**Note (post-design correction):** the original design (carried over from the poker reference) included a "Sign out" row at the bottom. It was removed — this app has no login/cloud account, so there's nothing to sign out of. If the Figma file still shows it, treat this note as authoritative and skip it during implementation.

### 3.13 Shop (`Blackjack / Shop`)
**Purpose:** monetization/currency screen, direct adaptation of the reference — the underlying "buy chips / open chests for bonus rewards" concept applies to Blackjack exactly as it did to poker, no gameplay-specific changes needed.

- Top bar: Balance (accent dot + amount), a bonus/rewards video icon (top-right, implies a rewarded-video-ad entry point — not fleshed out further).
- **Chests** section: three tiers (Wooden / Silver / Golden) at increasing chip prices, each a card with an icon, name, and price.
- **Chips** section: three purchasable chip packs (100K / 1M / 4M) with real-money prices ($1.99 / $7.99 / $14.99 as placeholder pricing). The middle option is visually highlighted (accent border) as the suggested "best value" — a common monetization pattern; this highlighting is a UI treatment only, not a stated business decision.
- Bottom nav (Shop active).

---

## 4. Cross-Screen Rules & Conventions

- **Balance vs. In-Play**: never conflate these two numbers in code. Balance is app-wide; In-Play is table-scoped and only exists while a Buy-in session is active.
- **Hero Number style** is reserved for the single most prominent number on a screen (used only for Balance on Home). Don't reuse it for secondary numbers.
- **Overlap/fan card layout** should trigger automatically once a hand has more than 2 cards, in every context (normal hand, each split hand).
- **Result overlays** always precede a Place Bet Sheet for the next round — there is no way to skip straight from a result back into an already-dealt hand.
- **Buy-in Sheet (mid-game)** is only triggered by In-Play reaching exactly 0; it is a different screen from the initial Buy-in screen (3.2) and includes the extra "Leave The Table" exit path that the initial screen does not have.
- Layer naming convention used throughout: functional names like `Player Hand Total`, `In-Play Panel`, `In-Play Amount`, `Dealt Card` — not generic Figma defaults. A few key layers also carry a `description` (via Figma's shared plugin data, namespace `blackjack.ds`) explaining their purpose in plain language; check those before renaming/removing anything.

---

## 5. Reusable Components (Design System page)

- **`Button/Pill`** — component set, variant property `State` = Default / Pressed / Disabled. All instances so far only use Default with overridden text (label is a plain text override, not a component property).
- **`Panel`** — generic rounded container (background = `color/bg-elevated`, border = `color/border`, radius = `radius/card`). Used as a base pattern for stat cards, sheets, and result cards (sometimes recreated as a plain frame with the same bound tokens rather than a true instance, since Panel has no content "slot").
- **`Card/Playing Card`** — component set, variant properties `Rank` (A, 2–10, J, Q, K) × `Suit` (Hearts, Diamonds, Clubs, Spades), plus one extra variant `Rank=Back, Suit=Back` for the face-down card. 53 total variants. Resizing instances **must use `.rescale()`, not `.resize()`**, or internal artwork (especially the face-down pattern) will clip instead of scaling proportionally — this bit the team once during design and is worth flagging to engineers translating this to a real UI-kit component.

See `design-tokens.md` for every raw value (hex colors, font sizes, spacing, radius).

---

## 5b. Post-Design Decisions (confirmed after this spec was first written)

Decisions with lasting weight (money model, house rules, settlement feedback, split UI, SDK pin) are also recorded with their reasons and rejected alternatives in `docs/adr/`. Where a line below and an ADR differ, the ADR is newer and wins.

- **Buy-in / In-Play mechanic (Sections 1, 3.2-3.4): confirmed, keep as designed.** This is intentionally more elaborate than a simple inline bet stepper — the two-tier Balance/In-Play system is approved and should be implemented in full, including the mid-game Buy-in Sheet and "Leave The Table" cash-out.
- **"Top Balances" leaderboard (Section 3.1): confirmed, keep as designed.** It stays cosmetic/flavor only, backed by static or seed data — not a real ranking against other users. Do not build a backend for this; see Section 4's local-only architecture in CLAUDE.md.
- **Dealer AI rule set — `dealerHitsSoftSeventeen` default (Section 6): confirmed as `false`.** The dealer stands on soft 17 (standard Vegas Strip rule, favors the player slightly over the `true` variant). The config toggle itself (already implemented in `src/game/rules.ts`) remains a real parameter, not hardcoded — but every call site (`gameEngine.ts` and any future settings/difficulty feature) should pass `false` unless a deliberate "hard mode" variant is added later.
- **Split Aces restriction (blackjack-game-logic.md §4): confirmed as unrestricted.** Split Aces are treated exactly like any other split hand — no limit to one extra card, hit/double/split remain available on Ace-split hands. This was left "configurable" in the original rules spec; the app deliberately does not implement the stricter casino-standard restriction, to keep the engine simpler. `src/game/gameEngine.ts`'s behavior (no special-casing for split Aces) already matches this decision.
- **Blackjack payout ratio (Section 6): confirmed as 3:2.** A `bet_amount` of 10 pays 15 on a natural blackjack. No schema change needed — the `hands` table has no payout column by design (CLAUDE.md §3.2); this ratio is applied at settlement time in `gameStore.ts`, not stored per-hand. Regular win = 1:1, push = bet returned, lose/bust = bet forfeited.
- **Initial wallet Balance: confirmed as 1,000 chips.** `src/storage/db.ts`'s `INITIAL_BALANCE = 1000` constant matches this.
- **BuyInScreen Balance display: confirmed as reactive.** The Balance number at the top updates in real time as the user drags the buy-in slider, showing (starting Balance − current buy-in amount) rather than a static figure. The slider is continuous free-drag, value rounded to the nearest 100 with re-render deduping for performance — see `src/components/DragSlider.tsx`.
- **Maximum split limit: confirmed as unlimited.** There is no cap on re-splitting — any hand that draws a new matching pair may be split again, indefinitely, exactly like the very first split. This means 3+ simultaneous hands is a normal, expected outcome, not an edge case.
- **Split-hand layout direction: confirmed as horizontal scroll.** An earlier verbal decision described split hands stacking vertically — that's superseded. Split hands scroll horizontally (side-by-side, ScrollView), matching `Split Hands - 3 Hands (Scroll).png`. The active/inactive dimming treatment (full brightness for the current hand, ~50% opacity for finished/waiting hands, "Bust" label where relevant) still applies regardless of axis — only the scroll direction changed, not the visual state logic.
- **Split button model: confirmed as an animated 4th button, NOT a full swap.** This supersedes both blackjack-app-spec.md §3.3's original "Split is not a fourth button" description and the earlier "Split/Don't Split fully replaces Hit/Stand/Double" fix. Current confirmed behavior: the resting state is always 3 buttons (Hit/Stand/Double). When the currently active hand is split-eligible, a 4th "Split" button animates in alongside them (row compresses to fit 4) — there is no separate "Don't Split" button anymore; declining is simply tapping Hit/Stand/Double directly, which naturally makes the hand ineligible to split (card count > 2) and the Split button animates back out. After an actual split, the button disappears for that resolved state; it reappears independently per-hand if a newly-created split hand is itself split-eligible.
- **Leave Table: confirmed as available anytime, including mid-hand.** A confirmation bottom sheet ("Are you sure to leave the table?"), styled like the existing Place Bet Sheet / Buy-in Sheet, appears on every back-button press regardless of game phase. Confirming while a hand is in progress forfeits that hand and its bet (written to `hands` as a loss, no payout) before crediting the remaining In-Play to Balance and closing the session — the same as a normal Leave Table, just with an extra forfeiture step first when mid-hand. **Amended 2026-10-04 (ADR-0008, R2):** during the dealer's turn the player's decisions are complete, so the hand is settled normally first, never forfeited.
- **Place Bet Sheet background: confirmed as the live, dimly-visible empty table**, same treatment as the Result overlay (blackjack-app-spec.md §3.10) — not an opaque/separate background. The dealer area (waiting, no cards dealt yet) sits dimmed behind the sheet.
- **Animated number counting: confirmed as global**, not scoped to just Double. Any UI element where a chip/money value changes (Double's bet amount, win/lose/push settlement amounts, Buy-in confirmation, Balance updates) should count up/down through intermediate values rather than snapping instantly to the new number. Implement as one shared reusable component, not bespoke per-screen logic.
- **Result overlay: REMOVED entirely, superseding blackjack-app-spec.md §3.10.** No modal/banner appears for Win, Lose, Push, Bust, or Blackjack — including the natural blackjack case, which was considered and deliberately not special-cased. Instead, the In-Play number itself animates (color-coded: green count-up for a win/blackjack payout, red count-down for a loss, no color change for a push) using the same AnimatedNumber component from the counting-number decision above. After settlement, the screen auto-returns to the next betting state after a brief pause — there is no "Next Hand" button anymore, since there's no overlay to dismiss.
- **Card size: must match design-tokens.md exactly** — 90×126px for normal (non-split) gameplay, 70×98px only within split hands. On-device testing found cards rendering smaller than this; verify against the token values, not the visual "feel."
- **Sheet/overlay primary buttons must render visible label text.** A bug found the primary CTA button in the Leave Table confirmation sheet (and, before its removal above, the Result overlay) rendering with no visible text, unlike ActionButtons (Hit/Stand/Double), which display correctly.
- **New "Cancel Bet" flow: confirmed.** The Place Bet Sheet gets a "Cancel" option. Canceling dismisses the sheet without starting a round and transitions to a new idle "waiting at table" state: decorative face-down cards for both the player (2 cards) and the dealer (matching the existing card-back design), no real hand data. In this state, the action button area shows a single full-width "Place Bet" bar instead of Hit/Stand/Double — tapping it reopens the Place Bet Sheet. Pressing back from this idle state leaves the table with no forfeiture (no hand exists yet, so the existing forfeiture loop in confirmLeaveTable should already no-op correctly here — verify this holds rather than adding new bypass logic).
- **Split mode must keep the In-Play panel visible.** A bug found the In-Play balance panel (and surrounding player info normally shown alongside the single-hand card row) disappearing entirely once split mode's horizontal hand-scroll layout takes over. It must remain visible regardless of split state.


## 6. Open Questions — NOT Decided During Design

These were never specified by the product owner. Do not assume the placeholder/example values below are final; treat them as illustrative only. Items struck through have since been decided; the rest are still open. New open rule questions from the 2026-10-04 audit (split A+ten payout, leaving during the dealer's turn, insurance) are listed in ADR-0004.

- ~~Maximum number of times a hand can be split (re-split limit).~~ **Decided: unlimited** (section 5b, ADR-0004).
- ~~Dealer AI rule set (e.g. does the dealer hit on a soft 17, or stand — standard house rules vary).~~ **Decided: stands on soft 17** (section 5b, ADR-0004).
- ~~Blackjack payout ratio (mock uses an illustrative +75 vs +50 base bet, implying 1.5:1, but this was never confirmed).~~ **Decided: 3:2** (section 5b, ADR-0004).
- Double Down's visual treatment — showing the bet amount increasing (e.g. "50 → 100") was discussed as a possible idea but explicitly de-scoped ("ignore this") by the product owner; no design exists for it.
- ~~Exact settlement timing/animation for chip amounts changing (In-Play going up/down) after a round resolves.~~ **Decided:** ADR-0005.
- ~~"Top Balances" leaderboard data source/scope (global all-time? weekly? real other users or seed data?).~~ **Decided: static seed data, cosmetic** (section 5b, ADR-0001).
- Real app name (currently placeholder "Blackjack" is used as both the in-app title and the Settings footer app name).
- Rank ladder naming/progression (placeholder "Rookie" used once, replacing the poker reference's "Fish").
- "Hand rankings" content (row exists in Settings, no screen designed).
- Notification bell icon on Home (present visually, no notification system designed).
- Rewarded-video icon on Shop (present visually, no reward-video flow designed).

---

## 7. Suggested Reading Order for a New AI/Developer Session

1. This file, in full.
2. `design-tokens.md` for exact values.
3. The Figma file's "Design System" page, to see the token/component definitions live.
4. The Figma "Screens" page, cross-referencing each frame against Section 3 above.
5. Section 6 before writing any logic this document doesn't explicitly cover — ask rather than assume, consistent with how this spec itself was produced.
