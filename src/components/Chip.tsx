import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../theme/tokens';
import AnimatedNumber from './AnimatedNumber';

export interface ChipProps {
  amount: number;
  // 'chip': dark rounded badge (Gameplay header balance chip).
  // 'plain': dot + number directly on the background, no container (Home/Shop top bar).
  variant?: 'chip' | 'plain';
  // docs/blackjack-app-spec.md section 5b: Balance should count up/down when
  // it changes as a result of a game action. Defaults to false — BuyInScreen
  // passes its own already-reactive slider-driven Balance display through
  // this same component and deliberately does NOT set this, since that's a
  // different, already-smooth interaction that doesn't need AnimatedNumber's
  // count-up treatment on top of it.
  animated?: boolean;
}

export default function Chip({ amount, variant = 'chip', animated = false }: ChipProps) {
  return (
    <View style={[styles.row, variant === 'chip' && styles.badge]}>
      <View style={styles.dot} />
      {animated ? (
        <AnimatedNumber value={amount} style={styles.amount} />
      ) : (
        <Text style={styles.amount}>{amount.toLocaleString()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.s16,
    paddingVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  amount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
  },
});
