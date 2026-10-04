# Figma Design Prompts — Blackjack App

This file contains one master design brief and five per-screen prompts, meant to be
fed into a Claude session with the Figma MCP connector, **in order**. Each screen
prompt is self-contained but assumes the master brief was applied first.

## How to use this (read before starting)

1. Paste **Prompt 0 (Master Design Brief)** first, in its own message. Let Figma
   generate the base design system (colors, type scale, spacing, corner radius,
   button styles) as actual Figma styles/variables, not just a description. Confirm
   the output looks right before moving on — this is the foundation every other
   screen depends on.
2. Paste each screen prompt **one at a time**, in the order listed below. Don't batch
   multiple screens into one message — Figma tends to blend/confuse layouts when
   asked to produce several distinct screens at once.
3. Before starting a new screen prompt, explicitly tell Claude: "Use the same design
   system (colors, type, spacing, button style) established in the previous screens —
   do not invent new tokens." This single sentence prevents the most common failure
   mode: each screen drifting into a slightly different visual style.
4. After all screens are generated, export each as PNG and place them in
   design/mockups/ (see CLAUDE.md section 4), named exactly as noted at the top of
   each prompt below. Then copy the final color/font/spacing values into
   docs/design-tokens.md and into CLAUDE.md section 6 — those files are currently
   placeholders waiting for these real values.
5. Order matters because later prompts reference earlier screens by name (e.g. "same
   card component used on Home"). Follow the sequence: Master Brief → Table → Home →
   Profile/Stats → Settings → Shop.

---

## Prompt 0 — Master Design Brief

```
I'm designing a mobile blackjack app (single-player vs. a rule-based dealer, no
multiplayer, no real money). Visual direction: dark theme, minimal, casino-app feel
similar to poker apps like Offsuit — deep near-black background, high-contrast white
typography, soft rounded pill-shaped buttons, one accent color used sparingly for
positive/active states (toggles, highlighted CTAs, win states).

Before designing any screen, establish a small design system as reusable Figma
styles/variables:
- Background color (near-black, not pure #000)
- Primary text color (white/near-white)
- Secondary/muted text color (gray, for labels and metadata)
- One accent color (used for: active toggles, primary CTA buttons, positive/win
  states — pick something that reads as "premium casino" rather than neon/gamey —
  consider a deep emerald or muted gold)
- One warning/negative color, used sparingly (loss states, bust)
- Type scale: a large "hero number" style for balance displays (thin/light weight,
  very large), H1 for screen titles, H2 for section headers, body text, small/caption
  text for metadata
- Spacing scale: 8 / 16 / 24 / 32 px
- Corner radius: one value for cards (larger, ~16-20px), one for pill buttons (full
  round), one for small chips/badges (full round)
- A pill-shaped button component with three states: default, pressed, disabled
- A card/panel component (rounded rect, subtle border or slight elevation) used as
  the base for stat cards, action panels, etc.

Also design one new asset: a card back pattern for playing cards, original design
(not a copy of any existing app's card back), fitting the dark/premium theme above —
something like a subtle geometric or abstract pattern in the accent color on a dark
base, not a bright/saturated pattern. This will be reused on every face-down card
across the app.

Also design the face-up card component. Attached is a reference image showing the
target visual style — replicate it exactly as a reusable Figma component:
- White (or very light) rounded-corner card, no border, subtle drop shadow for
  slight elevation
- Rank displayed as a large number/letter in the top-left corner
- Suit icon (heart, diamond, club, spade) displayed directly below the rank, roughly
  half the size of the rank text
- Color rule: hearts and diamonds in red, clubs and spades in black — no other colors
- Clean modern sans-serif font for the rank
- No decorative pip patterns, no illustrated face-card characters — keep it fully
  minimal like the reference
- For face cards (J, Q, K), use the same minimal treatment: the letter in place of a
  number, same style, no illustrated royalty figures — keep the whole deck visually
  consistent with this flat, minimal direction

Build this as ONE reusable Figma component with two variant properties: "rank" (A,
2-10, J, Q, K) and "suit" (hearts, diamonds, clubs, spades), rather than manually
designing 52 separate static cards. Also add a "face-down" variant using the card
back pattern from above.

Export: the component itself (not 52 individual images) — this will be built as a
single dynamic Card component in code, not 52 static assets.

Output: a Figma page named "Design System" containing all of the above as
inspectable, reusable styles — not just a static mockup image.
```

---

## Prompt 1 — Table / Gameplay Screen (the main screen — build this first after the design system)

**Attach:** the Offsuit gameplay screenshot (the one with 5 poker avatars, chip
counts, and the "2 of Hearts / 5 of Clubs" player cards). Use it as the layout/spacing
reference — same proportions for header/middle/action/player zones — but apply every
deviation described below; don't copy the poker-specific content (5 avatars,
Call/Raise buttons, 5 community cards).

**Save exported states as:** table_betting.png, table_dealing.png,
table_player_turn.png, table_insurance.png, table_split.png,
table_dealer_turn.png, table_result.png

```
Using the design system already established, design the main gameplay screen for a
single-player blackjack app. This is one screen with several states — design each
state as a separate frame in Figma, same base layout, so they can be compared
side-by-side.

OVERALL LAYOUT (top to bottom):
1. Header: back arrow top-left, no title text (minimal, matches reference apps).
2. Dealer area (top section): one dealer avatar, centered, with a label "Dealer"
   underneath, and a score badge next to it showing the dealer's current visible hand
   value (this updates per state, see below).
3. Middle area: the dealer's two cards, displayed horizontally centered. Use the new
   card back design from the design system for any face-down card.
4. Action area: a row of 1-3 pill-shaped buttons, content changes per state (see
   below) — this is the main interactive zone.
5. Player area (bottom section): the player's cards displayed in a fanned/overlapping
   layout (face up), next to a score panel showing the player's current hand total,
   the player's avatar, and their current chip balance.

Design the following STATES as separate frames:

STATE A — "table_betting": Before the round starts. Dealer area is empty/placeholder
(no cards yet). Middle area is empty. Instead of the action buttons, show a bet
selector inline: a row of chip-value buttons (e.g. +10 / +50 / +100) plus a current
bet total display, and a single "Deal" button to start the round.

STATE B — "table_dealing": A snapshot mid-animation — one card mid-flight, sliding in
from the left edge of the screen toward its destination (either a dealer card slot or
a player card slot). Design this as a clear visual reference for how the motion
should look: the card should appear to be sliding in from off-screen-left, not
rotating in 3D, not flipping — a simple horizontal slide-in. Note in the frame:
"This motion repeats twice for the player's first two cards, and separately for the
dealer's two cards."

STATE C — "table_player_turn": Normal turn state. Dealer shows one face-up card and
one face-down card (using the card back design), dealer score badge shows only the
face-up card's value (or a "?" if that's clearer). Player has 2 cards face-up.
Action buttons: three pills — "Hit", "Stand", "Double" — roughly equal width, filling
the action row.

STATE D — "table_insurance": Same layout as State C, but the dealer's face-up card is
specifically an Ace. The action buttons area is fully replaced (not stacked
alongside) by two buttons: "Insurance: Yes" and "Insurance: No". Include a small text
label above the buttons explaining briefly what's being asked (e.g. "Dealer shows an
Ace — take insurance?").

STATE E — "table_split": Same trigger context as State C, but the player's first two
cards are the same rank (e.g. two 8s). The action buttons area is fully replaced by
two buttons: "Split" and "Don't Split". After choosing "Split" (design this as a
follow-up frame within the same state group), the player area changes to show TWO
stacked hand rows instead of one — each with its own mini score badge and its own set
of cards. The currently active hand has full brightness/normal border. The hand
that's not currently active (waiting its turn, or already finished/stood) is dimmed
(reduced opacity, ~50%). If a hand busts, apply the same dimmed treatment plus a
small "Bust" label on that hand.

STATE F — "table_dealer_turn": Player has finished (stood/doubled/busted on all
hands). The dealer's hole card is shown mid-flip (or already flipped face-up) —
both dealer cards now visible, dealer score badge shows the real total. No action
buttons are shown in this state (player has no decisions left) — optionally show a
small "Dealer's turn..." label where the buttons would be.

STATE G — "table_result": A banner/overlay partially covering the lower portion of
the screen (not a full modal, not blocking the whole screen — the table should still
be dimly visible behind it). The banner shows: the outcome in large text (one of
"You Win", "You Lose", "Push", "Blackjack!"), the chip amount won or lost, and a
single "Next Hand" pill button. Use the accent color for win/blackjack outcomes and
the warning color for a loss outcome; push can use the neutral/secondary text color.

Keep all seven frames visually consistent — same header, same dealer/player area
proportions, only the content within the action area and player area changes between
states.
```

---

## Prompt 2 — Home Screen

**Attach:** the Offsuit Home screenshot (the one with the large "81,314" balance and
the "Cash Games" gradient card). Use it as the layout/spacing reference — same
proportions and visual weight for the balance number, status bar, and card zone —
but apply every deviation described below; don't copy the "Cash Games" wording, the
weekly leaderboard content, or the horizontal game-mode carousel.

**Save exported state as:** home.png

```
Using the same design system and card back design established previously, design the
Home screen for the single-player blackjack app.

LAYOUT (top to bottom):
1. Status bar row: chip icon + current chip balance (small, top-left), settings gear
   icon (top-right) — this app has no notifications/social features, so keep the top
   row minimal, just these two elements.
2. Large hero number: the player's chip balance, displayed very large, thin/light
   font weight, dominating the width of the screen — this is the single most
   emphasized element on the page (reuse the "hero number" style from the design
   system).
3. Primary CTA card: one large rounded card with a gradient or accent-colored
   background, a short title ("Play Blackjack" or similar), a one-line subtitle
   ("Practice your strategy" or similar), acting as the main entry point into the
   Table screen. This is the only card here — no horizontal carousel of other game
   modes, since this app has just one mode.
4. Quick stats teaser: a smaller card below the CTA showing 2-3 key numbers at a
   glance (e.g. "Win rate: 54%", "Hands played: 128"), tappable, leading to the
   Profile/Stats screen. This replaces the idea of a "leaderboard against other
   players" since this app has no multiplayer — the comparison is against the
   player's own past performance, not other people.
5. Bottom navigation: 3 icons — Shop, Home (active/highlighted), Profile.

Keep it minimal — this screen's job is to get the player into a hand of blackjack as
fast as possible, with their balance and recent performance visible at a glance.
```

---

## Prompt 3 — Profile / Stats Screen

**Attach:** the Offsuit Profile screenshot (avatar + username + the 2x2 info grid)
and the Statistics screenshot (radar chart with TAG/LAG/Rock/Fish). Use the avatar
block and overall page structure as the layout reference; do NOT replicate the radar
chart or the poker-specific stat cards (Emotes, Card Backs, Friends) — those are
described as replaced below.

**Save exported state as:** stats.png

```
Using the same design system established previously, design the Profile/Stats screen.

LAYOUT (top to bottom):
1. Status bar row: chip balance (top-left), settings gear icon (top-right).
2. Avatar block: large circular avatar centered, small edit/pencil button overlapping
   its bottom-right corner, player's display name in bold below it.
3. Stats summary: a row or grid of individual stat cards (not a radar chart — that
   visualization doesn't apply to a single-player game against fixed dealer rules).
   Include: Win Rate (%), Hands Played (count), Longest Win Streak (count), Natural
   Blackjack Rate (%), Biggest Win (chip amount). Each as its own small card with the
   number large and a short label beneath it, arranged in a clean grid (e.g. 2 columns).
4. Optional: a simple win/loss/push ratio visualization (a horizontal segmented bar
   or a simple donut chart) summarizing the same underlying data at a glance — treat
   this as a nice-to-have, not essential if it clutters the layout.
5. Bottom navigation: 3 icons — Shop, Home, Profile (active/highlighted).

Do not include: friends list, social features, emotes, or any multiplayer-related
content — this app has none of those. Keep the screen focused purely on the player's
own performance history.
```

---

## Prompt 4 — Settings Screen

**Attach:** the Offsuit Settings screenshot. Use its list layout, header style, row
dividers, and toggle style directly — this screen needs the least adaptation. Only
change the actual list items per the content below (notably: no "Sign Out", no "Hand
Rankings", no "Join our Discord").

**Save exported state as:** settings.png

```
Using the same design system established previously, design the Settings screen.

LAYOUT: standard list layout, dark background, back arrow top-left, "Settings" title
centered in the header (standard iOS/Android convention).

List items, each row separated by a thin divider line:
1. Player Name — shows the current local display name, with a chevron to edit it.
   (Note: this app has no account/login system — this is purely a local nickname,
   not tied to any server account.)
2. Sound — toggle switch, using the accent color when on.
3. Vibration — toggle switch, using the accent color when on.
4. How to Play — chevron, leads to a rules/reference screen (replaces "Hand
   Rankings" from poker-style references, since blackjack needs its own rules
   reference: card values, dealer rules, payout rules).
5. Reset Statistics — chevron, lets the player clear their local stats history.
6. Restore Purchases — chevron (relevant since the Shop has mocked chip purchases).
7. Privacy — chevron.
8. Credits — chevron.

Footer: small centered text showing the app version number.

Do NOT include a "Sign Out" row — this app has no login/account system, so there's
nothing to sign out of.
```

---

## Prompt 5 — Shop Screen

**Attach:** the Offsuit Shop screenshot (chests + chip packages grid). Use its card
grid layout and pricing-label style as the reference; do NOT replicate the Chests
section, the gem currency, or the second "Golden Chest"-style gacha content — this
app has only chip packages, described below.

**Save exported state as:** shop.png

```
Using the same design system established previously, design the Shop screen.

LAYOUT (top to bottom):
1. Status bar row: chip balance (top-left), close/back icon (top-right).
2. Section header: "Chips".
3. A grid or vertical list of 3-4 chip package cards, each showing: a chip icon/
   illustration, the chip amount (e.g. "100K", "1M", "4M"), and a price label (e.g.
   "$1.99"). Make clear via a small badge or label that this is a MOCK purchase flow
   for demo purposes — no real payment will be processed (e.g. a small "Demo" tag on
   the screen, or a footer note).

Keep this screen simple — a single currency (chips), no secondary currency, no
cosmetic items, no chest/gacha mechanics. This app's shop exists only to let players
top up their virtual chip balance when it runs low.
```

---

## Notes on what changed vs. the original poker reference

- Removed: multiplayer opponent avatars, weekly leaderboard vs. real players, friends
  list, emotes, hand-ranking (poker) reference, radar chart player-style analysis,
  Sign Out (no accounts), dual currency (gems + chips), chest/gacha mechanics.
- Added/changed: single dealer avatar, inline bet stepper before dealing, Hit/Stand/
  Double as primary actions, contextual Insurance and Split button states, dealer
  hole-card reveal flow, result banner with Next Hand, stacked split-hand layout,
  simplified single-currency Shop, "How to Play" replacing "Hand Rankings".
- New asset required: an original card back pattern (not reused from any reference
  app) — generated as part of the Master Design Brief.
