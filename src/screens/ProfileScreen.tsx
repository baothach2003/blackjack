import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Chip from '../components/Chip';
import { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors, fontFamily, radius, spacing } from '../theme/tokens';

// Still mocked deliberately, not a Phase 4 oversight: neither has any backing
// data model anywhere in CLAUDE.md's schema. Username has no storage at all
// (Settings' "Username" row is out of scope for this phase per your
// instruction), and "Card backs"/"Rank progress" are cosmetic collectibles
// blackjack-app-spec.md section 6 explicitly lists as undesigned open
// questions (no rank ladder, no card-back inventory system exists yet).
const USERNAME = '21bthach';
const CARD_BACKS = '2 (20)';
const RANK = 'Rookie';

type Navigation = NativeStackScreenProps<RootStackParamList>['navigation'];

export default function ProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const balance = useGameStore((s) => s.balance);
  const stats = useGameStore((s) => s.stats);
  const initialize = useGameStore((s) => s.initialize);
  const loadStats = useGameStore((s) => s.loadStats);

  useEffect(() => {
    if (balance === null) {
      void initialize();
    }
    void loadStats();
  }, [balance, initialize, loadStats]);

  const winRateDisplay = stats === null ? '—' : `${Math.round(stats.winRate * 100)}%`;
  const biggestWinDisplay = stats === null ? '—' : `+${stats.biggestWin.toLocaleString()}`;
  const handsPlayedDisplay = stats === null ? '—' : stats.handsPlayed.toLocaleString();
  const blackjacksHitDisplay = stats === null ? '—' : stats.naturalBlackjackCount.toLocaleString();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Chip amount={balance ?? 0} variant="plain" animated />
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
          <Text style={styles.gear}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{USERNAME[0].toUpperCase()}</Text>
          </View>
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeIcon}>✏️</Text>
          </View>
        </View>
        <Text style={styles.username}>{USERNAME}</Text>

        <View style={styles.rowCards}>
          <View style={styles.rowCard}>
            <Text style={styles.rowCardIcon}>🎴</Text>
            <Text style={styles.rowCardValue}>{CARD_BACKS}</Text>
            <Text style={styles.rowCardLabel}>Card backs</Text>
          </View>
          <View style={styles.rowCard}>
            <Text style={styles.rowCardIcon}>🃏</Text>
            <Text style={styles.rowCardValue}>{RANK}</Text>
            <Text style={styles.rowCardLabel}>Rank progress</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statGrid}>
          <StatCard label="Win Rate" value={winRateDisplay} accent />
          <StatCard label="Biggest Win" value={biggestWinDisplay} accent />
          <StatCard label="Hands Played" value={handsPlayedDisplay} />
          <StatCard label="Blackjacks Hit" value={blackjacksHitDisplay} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
    </View>
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
  gear: {
    fontSize: 24,
  },
  scrollContent: {
    paddingHorizontal: spacing.s24,
    paddingBottom: spacing.s32,
    alignItems: 'center',
  },
  avatarWrapper: {
    marginTop: spacing.s32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 48,
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadgeIcon: {
    fontSize: 16,
  },
  username: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 26,
    marginTop: spacing.s16,
    marginBottom: spacing.s32,
  },
  rowCards: {
    flexDirection: 'row',
    gap: spacing.s16,
    width: '100%',
    marginBottom: spacing.s32,
  },
  rowCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: spacing.s16,
    gap: spacing.s8,
  },
  rowCardIcon: {
    fontSize: 24,
  },
  rowCardValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 16,
  },
  rowCardLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 13,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 20,
    marginBottom: spacing.s16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s16,
    width: '100%',
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    padding: spacing.s24,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    marginBottom: spacing.s8,
  },
  statValue: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 24,
  },
  statValueAccent: {
    color: colors.accent,
  },
});
