# Architecture Decision Records

Each record holds one decision that shapes the code, why it was made, and what
was rejected. A record is never edited to change its decision: a later record
supersedes it, and the old one's Status says so.

Write a new ADR when a decision (a) is hard to reverse, (b) was reversed at
least once already, or (c) would otherwise be re-argued by the next session.
UX details that change often stay in `docs/blackjack-app-spec.md` section 5b.

| # | Decision | Status |
|---|---|---|
| [0001](0001-local-first-no-backend.md) | Local-first: on-device SQLite, no backend, no accounts | Accepted |
| [0002](0002-layered-architecture.md) | game / storage / store / UI layers, enforced by a test | Accepted |
| [0003](0003-balance-and-in-play.md) | Two money figures: Balance and In-Play | Accepted |
| [0004](0004-house-rules.md) | House rules: dealer stands on soft 17, 3:2, unlimited split | Accepted (3 points open) |
| [0005](0005-settlement-feedback.md) | No result overlay: the In-Play number reports the outcome | Accepted |
| [0006](0006-split-ui.md) | Split as an animated 4th button; split hands scroll sideways | Accepted |
| [0007](0007-expo-sdk-54-pin.md) | Expo SDK pinned to 54 for Expo Go | Accepted |

## Template

```
# ADR-NNNN: <decision in one line>

## Status
Proposed | Accepted | Superseded by ADR-NNNN

## Date
<decided>; recorded <date>

## Context
<the problem and the forces at play>

## Decision
<what was decided, precisely enough to test>

## Alternatives considered
<each one, and why it lost>

## Consequences
<what follows, good and bad; what the code must now do>
```
