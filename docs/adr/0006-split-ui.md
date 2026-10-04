# ADR-0006: Split as an animated 4th button; split hands scroll sideways

## Status
Accepted. Supersedes `docs/blackjack-app-spec.md` section 3.3's "Split is not
a fourth button" and the earlier "Split / Don't Split replaces the action row"

## Date
Decided during Phase 5 on-device testing (September 2026); recorded 2026-10-04

## Context
This decision changed three times: (1) a disabled 4th button always visible,
(2) a full swap to "Split / Don't Split", (3) the current model. Hands were
also first stacked vertically, then moved to a horizontal row. Recording the
final state stops the next session from reviving an earlier one.

## Decision
- The resting action row is always Hit / Stand / Double.
- When the active hand can split, a 4th "Split" button animates in and the row
  compresses to fit four. There is no "Don't Split" button: playing on (Hit,
  Stand, Double) is how the player declines, and the button animates out.
- Eligibility is evaluated per active hand, so a hand created by a split shows
  its own Split button if it can split again.
- Split hands sit side by side in a horizontal ScrollView. The active hand is
  full brightness with an accent border; waiting or finished hands are dimmed
  (about 50% opacity). The design also gives a busted hand a "Bust" label;
  **not built yet** (audit 2026-10-04, finding U1). When the active hand
  changes, the row scrolls to centre it.
- The In-Play panel stays visible in split mode.
- Action buttons have a fixed height (49 px) on both the pill and its animated
  wrapper; their height must never depend on measured text.

## Alternatives considered
- **Always-visible disabled Split button.** Clutters the row for the common
  case. Rejected.
- **Split / Don't Split swap.** One extra tap to decline. Rejected.
- **Vertical stack of hands.** Ran out of height quickly. Rejected.

## Consequences
- `canSplit` is the single source for the button's presence; the screen never
  checks cards itself.
- The fixed button height came from a bug where single-button rows rendered
  with no visible label (text measured as 0 px high on first layout). Do not
  return to content-derived height.
