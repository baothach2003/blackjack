# Blackjack App

A single-player blackjack game against a rule-based dealer, built with React Native
and Expo for iOS and Android from one codebase. Portfolio-grade project — virtual
chips only, no multiplayer, no real money, no login/cloud account.

## Running locally

```bash
npm install                        # install deps
npx expo start                     # run dev server, scan QR with Expo Go
npx tsc --noEmit                   # type check
npx eslint src/ --max-warnings=0   # lint
npx jest                           # tests, including the architecture test
```

## Docs

Full specs live in [`docs/`](docs/):

- [`docs/blackjack-game-logic.md`](docs/blackjack-game-logic.md) — rules & scoring logic
- [`docs/blackjack-app-spec.md`](docs/blackjack-app-spec.md) — screen-by-screen UX behavior (source of truth)
- [`docs/project-plan.md`](docs/project-plan.md) — phase-by-phase roadmap
- [`docs/design-tokens.md`](docs/design-tokens.md) — colors, type, spacing, radius

- [`docs/adr/`](docs/adr/) — why the key decisions were made, and what was rejected
- [`docs/audit/`](docs/audit/) — dated audits with triaged findings

How the project is built with AI coding agents:

- [`CLAUDE.md`](CLAUDE.md) — rules every agent session follows (architecture, conventions, session workflow)
- [`CONSTRAINTS.md`](CONSTRAINTS.md) — the quality gates each session must pass
- [`SESSION_PROMPT.md`](SESSION_PROMPT.md) — the prompt that starts each session, with ready-made scopes
- [`docs/SKILLS.md`](docs/SKILLS.md) — which agent skills are installed and why
