// Raw values transcribed from docs/design-tokens.md — the canonical source.
// Don't invent new values here; if something's missing, it's missing there too.

export const colors = {
  bg: '#0D0D0F',
  bgElevated: '#17171A',
  textPrimary: '#F5F5F5',
  textSecondary: '#8E8E93',
  accent: '#2ECC71',
  accentOn: '#0D0D0F',
  accentPressed: '#27AE60',
  negative: '#E74C3C',
  border: '#2A2A2E',
  cardFace: '#FAFAFA',
  suitRed: '#E74C3C',
  suitBlack: '#1A1A1A',
  disabledBg: '#222225',
  disabledText: '#5A5A5E',
  cardBackBg: '#0B0B0E',
} as const;

export const spacing = {
  s8: 8,
  s16: 16,
  s24: 24,
  s32: 32,
} as const;

export const radius = {
  card: 20,
  pill: 999,
  chip: 8,
  playingCard: 12,
} as const;

// Font family is Inter (see docs/design-tokens.md section 2), loaded via
// @expo-google-fonts/inter. Fall back to the platform system font stack if a
// screen renders before fonts finish loading.
export const fontFamily = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  heroNumber: { fontFamily: fontFamily.light, fontSize: 64, lineHeight: 64 },
  h1: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fontFamily.semiBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17 },
} as const;

export const cardSize = {
  normal: { width: 90, height: 126 },
  split: { width: 70, height: 98 },
} as const;

// Negative item spacing for the overlapping "fan" card layout (3+ cards),
// per docs/design-tokens.md section 3 / blackjack-app-spec.md section 3.8.
export const cardOverlap = {
  normal: -50,
  split: -35,
} as const;

export const cardElevation = {
  shadowColor: '#000000',
  shadowOpacity: 0.35,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 24,
  elevation: 8, // Android fallback: shadow props above are iOS-only
} as const;

// docs/project-plan.md Phase 5, per the confirmed original design: cards
// slide in from the left edge, snappy per-card, with a brief stagger when
// several are dealt in the same batch (e.g. the dealer hitting more than
// once). Shared by Card.tsx (which plays the animation) and gameStore.ts
// (which paces the dealer-turn pause to always outlast however long the
// dealer's own card animations take) — lives here, not in either of those
// files, so the store never has to import from a component file to know it.
export const dealAnimation = {
  durationMs: 300,
  staggerMs: 150,
} as const;
