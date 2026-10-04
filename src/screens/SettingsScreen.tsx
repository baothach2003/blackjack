import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors, fontFamily, radius, spacing } from '../theme/tokens';

const MOCK_USERNAME = '21bthach';

// CLAUDE.md section 9: this app has no login/account system, so — unlike the
// poker reference this design was adapted from — there is no "Sign out" row
// here, even though the exported mockup still shows one.
const NAV_ROWS = [
  'Send us an email',
  'Join our Discord',
  'Share the app',
  'Hand rankings',
  'Restore purchases',
  'Privacy',
  'Credits',
];

type Navigation = NativeStackScreenProps<RootStackParamList>['navigation'];

export default function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const [soundOn, setSoundOn] = useState(true);
  const [vibrationOn, setVibrationOn] = useState(true);
  const resetBalanceForTesting = useGameStore((s) => s.resetBalanceForTesting);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.backArrowSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Row label="Username" value={MOCK_USERNAME} showChevron onPress={() => {}} />

        <ToggleRow label="Sound" value={soundOn} onValueChange={setSoundOn} />
        <ToggleRow label="Vibration" value={vibrationOn} onValueChange={setVibrationOn} />

        {NAV_ROWS.map((label) => (
          <Row key={label} label={label} showChevron onPress={() => {}} />
        ))}

        {/* DEV/QA-ONLY row — see gameStore.resetBalanceForTesting and
            walletRepository.resetBalanceForTesting. Exists purely so manual
            device testing doesn't burn through the starting Balance and
            require a reinstall. Remove or gate this before Phase 8
            (packaging) — same spirit as the Phase-3 demo harness, not meant
            to ship. */}
        <Pressable style={styles.row} onPress={() => void resetBalanceForTesting()}>
          <View style={styles.devRowLeft}>
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>DEV</Text>
            </View>
            <Text style={styles.rowLabel}>Reset Test Balance</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.footer}>Blackjack 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  showChevron,
  onPress,
}: {
  label: string;
  value?: string;
  showChevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
        {showChevron && <Text style={styles.chevron}>›</Text>}
      </View>
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.disabledBg, true: colors.accent }}
        thumbColor={colors.textPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.s24,
    paddingTop: spacing.s16,
  },
  backArrow: {
    color: colors.textPrimary,
    fontSize: 24,
  },
  backArrowSpacer: {
    width: 24,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 22,
  },
  scrollContent: {
    paddingHorizontal: spacing.s24,
    paddingTop: spacing.s24,
    paddingBottom: spacing.s32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.s16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.regular,
    fontSize: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s8,
  },
  rowValue: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 16,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 20,
  },
  devRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s8,
  },
  devBadge: {
    backgroundColor: colors.negative,
    borderRadius: radius.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  devBadgeText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  footer: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.s24,
  },
});
