# ADR-0002: Layered architecture, enforced by a test

## Status
Accepted

## Date
Decided in Phase 0 (August 2026); enforcement test added 2026-10-04

## Context
Game rules (scoring, dealer logic, payouts) are the part most likely to be
wrong in a way nobody notices on screen. They must be testable in isolation,
without rendering anything. A first draft added a `GameSource` abstraction to
prepare for multiplayer; multiplayer was dropped, so that layer would only add
indirection.

## Decision
Four layers under `src/`, each allowed to import only what is listed:

| Layer | May import |
|---|---|
| `game/` | nothing outside itself; no packages at all |
| `storage/` | itself and `expo-sqlite` only |
| `store/` | `game/`, `storage/`, `theme/`, `zustand` |
| `components/`, `screens/`, `navigation/`, `hooks/` | `store/`, `theme/`, each other as listed in the test, and `game/types.ts` (data types only, never logic) |

`theme/` holds plain design-token constants and imports nothing.
`src/__tests__/architecture.test.ts` parses every import with the TypeScript
compiler and fails the suite on any violation. It also checks that a planted
violation in each layer is still caught, so the checker cannot be weakened
silently.

No `GameSource` abstraction: `store/gameStore.ts` calls `game/gameEngine.ts`
directly.

## Alternatives considered
- **Rule written in CLAUDE.md only (the state until 2026-10-04).** Held so far,
  but only because every review happened to check it. Rejected: a rule that
  matters this much should fail the build, not rely on attention.
- **ESLint `no-restricted-imports`.** Workable, but spreads the rules across
  per-folder overrides and cannot easily prove the checker still bites.
  Rejected in favour of one readable test.
- **Keep `GameSource` for a future multiplayer.** Speculative. Rejected.

## Consequences
- A component that needs game data gets it from the store, already derived
  (`HandView`, `DealerView`), never by calling the engine.
- Test files are exempt: a test may reach across layers to build fixtures.
- Adding a new top-level folder under `src/` fails the "known layer" check
  until the test gets a rule for it, which forces the decision to be made
  explicitly.
