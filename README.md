# Blackjack App

A single-player blackjack game against a rule-based dealer, built with React Native
and Expo for iOS and Android from one codebase. Portfolio-grade project — virtual
chips only, no multiplayer, no real money, no login/cloud account.

## Running locally

```bash
npm install                 # install deps
npx expo start               # run dev server, scan QR with Expo Go
npm test                     # run Jest unit tests
npx eslint src/              # lint
```

## Docs

Full specs live in [`docs/`](docs/):

- [`docs/blackjack-game-logic.md`](docs/blackjack-game-logic.md) — rules & scoring logic
- [`docs/blackjack-app-spec.md`](docs/blackjack-app-spec.md) — screen-by-screen UX behavior (source of truth)
- [`docs/project-plan.md`](docs/project-plan.md) — phase-by-phase roadmap
- [`docs/design-tokens.md`](docs/design-tokens.md) — colors, type, spacing, radius

See [`CLAUDE.md`](CLAUDE.md) for the condensed architecture/conventions summary.
