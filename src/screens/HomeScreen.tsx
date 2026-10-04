import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AnimatedNumber from '../components/AnimatedNumber';
import Chip from '../components/Chip';
import { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors, fontFamily, radius, spacing, typography } from '../theme/tokens';

// "Top Balances" stays static/seed mock data — blackjack-app-spec.md section
// 5b confirms this is intentional: cosmetic/flavor only, "not a real ranking
// against other users... do not build a backend for this." Only the
// player's own row (last one) reflects real Balance instead of a fixed number.
const USERNAME = '21bthach';
const OTHER_TOP_BALANCES = [
  { rank: '🥇', username: 'tobydog', balance: 142300 },
  { rank: '🥈', username: 'harder011', balance: 98150 },
  { rank: '🥉', username: 'icy_hen', balance: 76420 },
];

type Navigation = NativeStackScreenProps<RootStackParamList>['navigation'];

export default function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const balance = useGameStore((s) => s.balance);
  const initialize = useGameStore((s) => s.initialize);

  useEffect(() => {
    if (balance === null) {
      void initialize();
    }
  }, [balance, initialize]);

  const displayBalance = balance ?? 0;
  const topBalances = [...OTHER_TOP_BALANCES, { rank: '4', username: USERNAME, balance: displayBalance }];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Chip amount={displayBalance} variant="plain" animated />
        <Text style={styles.bell}>🔔</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <AnimatedNumber value={displayBalance} style={styles.heroNumber} />

        <Pressable style={styles.ctaCard} onPress={() => navigation.navigate('BuyIn')}>
          <Text style={styles.ctaIcon}>♠️</Text>
          <Text style={styles.ctaTitle}>Blackjack</Text>
          <Text style={styles.ctaSubtitle}>Play against the dealer</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Top Balances</Text>
        {topBalances.map((entry) => (
          <View key={entry.username} style={styles.balanceRow}>
            <Text style={styles.balanceRank}>{entry.rank}</Text>
            <Text style={styles.balanceUsername}>{entry.username}</Text>
            <Text style={styles.balanceAmount}>{entry.balance.toLocaleString()}</Text>
          </View>
        ))}
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
  bell: {
    fontSize: 24,
  },
  scrollContent: {
    paddingHorizontal: spacing.s24,
    paddingBottom: spacing.s32,
  },
  heroNumber: {
    color: colors.textPrimary,
    ...typography.heroNumber,
    marginTop: spacing.s24,
    marginBottom: spacing.s32,
  },
  ctaCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    padding: spacing.s24,
    marginBottom: spacing.s32,
  },
  ctaIcon: {
    fontSize: 32,
    marginBottom: spacing.s16,
  },
  ctaTitle: {
    color: colors.accentOn,
    fontFamily: fontFamily.bold,
    fontSize: 28,
    marginBottom: spacing.s8,
  },
  ctaSubtitle: {
    color: colors.accentOn,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    opacity: 0.85,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    marginBottom: spacing.s16,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.s16,
  },
  balanceRank: {
    width: 32,
    color: colors.textSecondary,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  balanceUsername: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
  },
  balanceAmount: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 18,
  },
});
