# ADR-0007: Expo SDK pinned to 54

## Status
Accepted

## Date
Decided during Phase 3 device testing (September 2026); recorded 2026-10-04

## Context
The project was scaffolded with the newest SDK. The App Store build of Expo
Go only supports SDK 54 (Apple had not approved a newer Expo Go), so the app
could not be opened on the tester's iPhone at all.

## Decision
- `"expo": "~54.0.0"` in `package.json`; every Expo package aligned with
  `npx expo install --fix`.
- `react-native-worklets` is installed explicitly: on this pin it is not
  pulled in as a transitive dependency of `react-native-reanimated`.
- Use `StyleSheet.absoluteFillObject`, never `absoluteFill`, inside style
  arrays (on this React Native version `absoluteFill` is not spreadable).

## Alternatives considered
- **Stay on the newest SDK and test with a development build.** Needs a
  native build per change and an Apple developer account. Rejected for the
  testing phase.

## Consequences
- Never run `expo upgrade`, and never re-scaffold with `create-expo-app@latest`,
  without first checking which SDK the App Store's Expo Go supports.
- Upgrading is a new ADR, to be revisited before Phase 8 (packaging), where an
  EAS build no longer depends on Expo Go.
