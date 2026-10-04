import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card as CardData } from '../game/types';
import { cardOverlap, colors, dealAnimation, fontFamily, radius, spacing } from '../theme/tokens';
import Card, { CardVariant } from './Card';

export interface PlayerHandProps {
  cards: CardData[];
  total: number;
  variant?: CardVariant;
  // Presence of `label` switches on the bordered split-hand column chrome
  // (blackjack-app-spec.md 3.6/3.7); omit it for the plain single-hand layout.
  label?: string;
  isActive?: boolean;
  dimmed?: boolean;
  // Explicit per-card deal-in stagger delays (ms), overriding the automatic
  // "stagger only cards added since the last render" behavior below — used
  // for the initial deal, where this hand's cards interleave with the
  // dealer's in one global sequence (see GameplayScreen). Leave unset for a
  // Hit, where this hand's own local auto-stagger is already correct.
  dealDelays?: number[];
}

export default function PlayerHand({
  cards,
  total,
  variant = 'normal',
  label,
  isActive = false,
  dimmed = false,
  dealDelays,
}: PlayerHandProps) {
  const isSplitColumn = label !== undefined;

  // Auto-stagger: cards already present before the last render don't remount
  // (stable key), so their deal-in already played once and this delay is
  // irrelevant for them — only cards added since then (a Hit) get staggered.
  const previousCardCountRef = useRef(0);
  const autoDelays = cards.map((_, index) =>
    index >= previousCardCountRef.current ? (index - previousCardCountRef.current) * dealAnimation.staggerMs : 0,
  );
  useEffect(() => {
    previousCardCountRef.current = cards.length;
  }, [cards.length]);

  // docs/design-tokens.md section 3: cards always fan/overlap with negative
  // spacing (-50 normal, -35 split), never a plain positive gap.
  const cardRow = (
    <View style={styles.cardRow}>
      {cards.map((card, index) => (
        <View
          key={`${card.rank}-${card.suit}-${index}`}
          style={index > 0 ? { marginLeft: cardOverlap[variant] } : undefined}
        >
          <Card card={card} variant={variant} dealDelayMs={dealDelays?.[index] ?? autoDelays[index]} />
        </View>
      ))}
    </View>
  );

  if (!isSplitColumn) {
    return (
      <View>
        <Text style={styles.plainTotal}>{total}</Text>
        {cardRow}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.column,
        { borderColor: isActive ? colors.accent : colors.border },
        dimmed && styles.dimmed,
      ]}
    >
      <View style={styles.columnHeader}>
        <Text style={[styles.columnLabel, isActive && styles.columnLabelActive]}>{label}</Text>
        <Text style={[styles.columnTotal, isActive && styles.columnTotalActive]}>{total}</Text>
      </View>
      {cardRow}
    </View>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
  },
  plainTotal: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 28,
    marginBottom: spacing.s16,
  },
  column: {
    borderWidth: 1.5,
    borderRadius: radius.card - 4,
    padding: spacing.s16,
  },
  dimmed: {
    opacity: 0.55,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s16,
  },
  columnLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  columnLabelActive: {
    color: colors.accent,
  },
  columnTotal: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 20,
  },
  columnTotalActive: {
    color: colors.accent,
  },
});
