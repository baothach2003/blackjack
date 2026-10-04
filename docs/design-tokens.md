# Blackjack App — Design Tokens

Raw values for everything defined in the Figma "Design System" page. Companion to `blackjack-app-spec.md` (which explains *where and why* these are used).

All tokens live in Figma as **Variables** (not just styles), organized into three collections: `Colors`, `Spacing`, `Radius`. Text styles and one effect style are separate Figma Style objects (not variables), listed in Sections 2 and 5.

---

## 1. Colors

Figma variable collection: **`Colors`** (single mode, named "Value").

| Token name | Hex | Usage |
|---|---|---|
| `color/bg` | `#0D0D0F` | App background. Near-black, not pure black. |
| `color/bg-elevated` | `#17171A` | Elevated surfaces: panels, cards, sheets, stat cards. |
| `color/text-primary` | `#F5F5F5` | Primary text, near-white (not pure white). |
| `color/text-secondary` | `#8E8E93` | Secondary/muted text — labels, captions, metadata. |
| `color/accent` | `#2ECC71` | Single accent color (emerald green). Active toggles, primary CTA buttons, positive/win states. |
| `color/accent-on` | `#0D0D0F` | Text/icon color placed *on top of* an accent-colored surface (e.g. text inside the accent-filled primary button). |
| `color/accent-pressed` | `#27AE60` | Pressed/active state of accent-colored elements (darker emerald), e.g. `Button/Pill` Pressed variant. |
| `color/negative` | `#E74C3C` | Warning/negative color. Used sparingly: loss states, bust, red suits. |
| `color/border` | `#2A2A2E` | Hairline borders/strokes on panels and cards. |
| `color/card-face` | `#FAFAFA` | Background fill of a face-up playing card. |
| `color/suit-red` | `#E74C3C` | Hearts & Diamonds rank/suit text (same hex as `color/negative`, defined as a separate token intentionally so card-color and status-color can diverge later without one breaking the other). |
| `color/suit-black` | `#1A1A1A` | Clubs & Spades rank/suit text. |
| `color/disabled-bg` | `#222225` | Background of a disabled button. |
| `color/disabled-text` | `#5A5A5E` | Text/label color inside a disabled button. |
| `color/card-back-bg` | `#0B0B0E` | Background of the face-down card (slightly darker/bluer than `color/bg` so the card reads as an object sitting on the background). |

Card-back geometric pattern (diamonds, ring, dot) uses `color/accent` at reduced opacity (stroke ~18–35%) rather than a separate token — see Section 6 (Effects) for the one non-color style used on cards.

---

## 2. Typography

**Font family:** Inter (all weights below are Inter weight variants, not separate font families).

Figma text styles (Section listed as "Value" — no per-style variables, these are direct Figma Type Styles):

| Style name | Size | Weight | Line height | Typical use |
|---|---|---|---|---|
| `Hero Number` | 64px | Light | 100% | The single largest number on a screen — reserved for the Balance display on Home. |
| `H1` | 28px | Bold | 120% | Large headings — screen titles used as emphasis (e.g. large numeric displays like Buy-in amount). |
| `H2` | 20px | Semi Bold | 130% | Section/screen headers (e.g. "Blackjack" title bar, "Statistics", dealer's visible total). |
| `Body` | 16px | Regular | 140% | Standard readable text, list rows, buttons. |
| `Caption` | 13px | Medium | 130% | Small labels/metadata — "DEALER", "YOU"/hand-total position, stat card labels. |

Additional ad-hoc sizes used directly in screens (not formalized as named text styles, listed here for completeness since they recur):

| Size | Weight | Where used |
|---|---|---|
| 52px | Bold | Buy-in / Bet sheet large numeric amount |
| 44px | Bold | Bottom-sheet numeric amount (Buy-in Sheet, Place Bet Sheet) |
| 32px | Bold | Rank text on playing cards; icon glyphs |
| 26px | Bold | Result overlay title; Profile username |
| 24px | Bold | Stat card values (Profile) |
| 22px | Bold/Semi Bold | Screen titles ("Settings"), result overlay amount |
| 16px | Semi Bold | Button labels, chip amounts, list-row primary text |
| 15px | Regular/Medium | Body copy in sheets, settings rows |
| 13px | Semi Bold | Chip package prices |
| 12px | Medium | Split-hand column labels ("HAND 1") |

---

## 3. Spacing Scale

Figma variable collection: **`Spacing`**.

| Token name | Value |
|---|---|
| `spacing/8` | 8px |
| `spacing/16` | 16px |
| `spacing/24` | 24px |
| `spacing/32` | 32px |

Used for auto-layout padding/gaps throughout (button padding, panel padding, screen margins). Standard screen horizontal margin is 24px (`spacing/24`) on both sides.

Non-tokenized spacing values that recur (smaller/one-off gaps not promoted to the scale):
- `6px` — small gaps (chip icon-to-text, chest/chip card internal gaps)
- `10–12px` — card-to-card gaps in a normal (non-overlapping) row
- Negative spacing for overlapping "fan" cards: `-50px` (full-size 90px cards), `-35px` (60%-scaled 70px cards) — see spec doc Section 3.8.

---

## 4. Corner Radius Scale

Figma variable collection: **`Radius`**.

| Token name | Value | Usage |
|---|---|---|
| `radius/card` | 20px | Panels, sheets (top corners), stat cards, result cards. |
| `radius/pill` | 999px | Fully-rounded pill buttons, chip badges. |
| `radius/chip` | 8px | Small chip/badge elements (e.g. Balance chip background). |
| `radius/playing-card` | 12px | Playing card component corners (smaller radius than generic panels — cards read as a distinct, more compact object). |

---

## 5. Effects

Figma Effect Style:

| Style name | Type | Value |
|---|---|---|
| `Card Elevation` | Drop shadow | Color `#000000` @ 35% opacity, offset X 0 / Y 8, blur radius 24, spread 0 |

Applied to every playing card instance (face-up and face-down) to lift it off the background.

---

## 6. Component-Level Notes

- **`Button/Pill`** sizing: default instance content padding uses `spacing/24` (horizontal) and `spacing/16` (vertical); corner radius `radius/pill`.
- **Playing card** base (unscaled) size: **140 × 196px**. All smaller on-screen instances (90×126 in normal gameplay, 70×98 in split hands) are proportional scales of this base — always scale via a uniform ratio, never stretch width/height independently, or suit/rank glyph proportions will distort.
- **Face-down card pattern** (diamonds + ring + dot) is hand-drawn geometry, not an image asset — safe to recolor by simply rebinding its strokes to `color/accent` (or a different token later) without touching geometry.

---

## 7. Quick Reference — Everything in One Table

| Category | Token/Style | Value |
|---|---|---|
| Color | `color/bg` | `#0D0D0F` |
| Color | `color/bg-elevated` | `#17171A` |
| Color | `color/text-primary` | `#F5F5F5` |
| Color | `color/text-secondary` | `#8E8E93` |
| Color | `color/accent` | `#2ECC71` |
| Color | `color/accent-on` | `#0D0D0F` |
| Color | `color/accent-pressed` | `#27AE60` |
| Color | `color/negative` | `#E74C3C` |
| Color | `color/border` | `#2A2A2E` |
| Color | `color/card-face` | `#FAFAFA` |
| Color | `color/suit-red` | `#E74C3C` |
| Color | `color/suit-black` | `#1A1A1A` |
| Color | `color/disabled-bg` | `#222225` |
| Color | `color/disabled-text` | `#5A5A5E` |
| Color | `color/card-back-bg` | `#0B0B0E` |
| Type | `Hero Number` | Inter Light 64 / 100% |
| Type | `H1` | Inter Bold 28 / 120% |
| Type | `H2` | Inter Semi Bold 20 / 130% |
| Type | `Body` | Inter Regular 16 / 140% |
| Type | `Caption` | Inter Medium 13 / 130% |
| Spacing | `spacing/8` | 8px |
| Spacing | `spacing/16` | 16px |
| Spacing | `spacing/24` | 24px |
| Spacing | `spacing/32` | 32px |
| Radius | `radius/card` | 20px |
| Radius | `radius/pill` | 999px |
| Radius | `radius/chip` | 8px |
| Radius | `radius/playing-card` | 12px |
| Effect | `Card Elevation` | Drop shadow, #000 35%, Y 8, blur 24 |
