# ADR-0001: Local-first, on-device SQLite, no backend and no accounts

## Status
Accepted

## Date
Decided at project start (August 2026); recorded 2026-10-04

## Context
The app is a single-player portfolio piece. Early drafts considered a Node.js
backend with PostgreSQL and Redis, then a hosted service (Firebase/Supabase),
mainly to support multiplayer, a global leaderboard and cross-device sync.
Multiplayer was later dropped for good, and neither sync nor a real leaderboard
was wanted. A backend would add auth, hosting cost, network failure modes and
App Store review surface for no feature the app actually has.

## Decision
- All state lives on the device: `expo-sqlite`, three tables (`wallet`,
  `sessions`, `hands`), schema in `CLAUDE.md` section 3.2.
- No network call of any kind, no login, no account. Settings has a local
  display name only and no "Sign out".
- Profile statistics are SQL queries over `hands`, never stored counters.
- The Home "Top Balances" list is static seed data, cosmetic only.

## Alternatives considered
- **Node.js + PostgreSQL + Redis + Socket.io.** Built for multiplayer, which is
  out of scope. Rejected.
- **Firebase / Supabase.** Cheaper than a custom backend, still adds accounts,
  network errors and a privacy policy that must describe a server. Rejected
  while no feature needs it.
- **AsyncStorage.** Simpler, but cannot aggregate (win rate, longest streak)
  without loading every hand into memory. Rejected for anything statistical.

## Consequences
- Data is lost if the app is deleted, and does not follow the player to a new
  phone. Accepted for v1.
- A cloud sync, if ever wanted, is a new ADR that supersedes this one, not a
  quiet addition (`docs/project-plan.md` Backlog).
- The Top Balances list must never be presented as a real ranking.
