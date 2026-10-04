import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Chip from '../components/Chip';
import { colors, fontFamily, radius, spacing } from '../theme/tokens';

// Mock data only — Phase 3 is static UI, no gameStore/repository calls yet.
// Chip package prices are placeholders per blackjack-app-spec.md 3.13, not a
// stated business decision.
const MOCK_BALANCE = 1240;

const CHESTS = [
  { icon: '🪵', name: 'Wooden', price: 50 },
  { icon: '🥈', name: 'Silver', price: 100 },
  { icon: '🥇', name: 'Golden', price: 150 },
];

const CHIP_PACKS = [
  { icon: '🪙', name: '100K', price: '$1.99', highlighted: false },
  { icon: '🪙', name: '1M', price: '$7.99', highlighted: true },
  { icon: '🪙', name: '4M', price: '$14.99', highlighted: false },
];

export default function ShopScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Chip amount={MOCK_BALANCE} variant="plain" />
        <Text style={styles.clapper}>🎬</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Chests</Text>
        <View style={styles.row}>
          {CHESTS.map((chest) => (
            <View key={chest.name} style={styles.card}>
              <Text style={styles.cardIcon}>{chest.icon}</Text>
              <Text style={styles.cardName}>{chest.name}</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceDot} />
                <Text style={styles.priceText}>{chest.price}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.chipsTitle]}>Chips</Text>
        <View style={styles.row}>
          {CHIP_PACKS.map((pack) => (
            <View key={pack.name} style={[styles.card, pack.highlighted && styles.cardHighlighted]}>
              <Text style={styles.cardIcon}>{pack.icon}</Text>
              <Text style={styles.cardName}>{pack.name}</Text>
              <Text style={styles.cardMoneyPrice}>{pack.price}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.s24,
    paddingTop: spacing.s16,
  },
  clapper: {
    fontSize: 22,
  },
  scrollContent: {
    paddingHorizontal: spacing.s24,
    paddingBottom: spacing.s32,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    marginTop: spacing.s32,
    marginBottom: spacing.s16,
  },
  chipsTitle: {
    marginTop: spacing.s32,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.s16,
  },
  card: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: spacing.s24,
    alignItems: 'center',
    gap: spacing.s8,
  },
  cardHighlighted: {
    borderColor: colors.accent,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  priceText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
  cardMoneyPrice: {
    color: colors.accent,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
});
