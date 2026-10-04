import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActionButtons from '../components/ActionButtons';
import DragSlider from '../components/DragSlider';
import { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { colors, fontFamily, spacing } from '../theme/tokens';

const DEFAULT_BUY_IN = 200;

type Navigation = NativeStackScreenProps<RootStackParamList>['navigation'];

export default function BuyInScreen() {
  const navigation = useNavigation<Navigation>();
  const { width: windowWidth } = useWindowDimensions();
  const balance = useGameStore((s) => s.balance);
  const isLoading = useGameStore((s) => s.isLoading);
  const error = useGameStore((s) => s.error);
  const initialize = useGameStore((s) => s.initialize);
  const startBuyIn = useGameStore((s) => s.startBuyIn);

  const [buyInAmount, setBuyInAmount] = useState(DEFAULT_BUY_IN);

  // Balance is real walletRepository data (via gameStore), loaded once on
  // mount if it isn't already — e.g. arriving here before HomeScreen ever ran.
  useEffect(() => {
    if (balance === null) {
      void initialize();
    }
  }, [balance, initialize]);

  // Once real Balance loads, make sure the default buy-in never starts above
  // what the player actually has.
  useEffect(() => {
    if (balance !== null) {
      setBuyInAmount((current) => Math.min(current, balance));
    }
  }, [balance]);

  const displayedBalance = balance === null ? null : balance - buyInAmount;

  const handleStartGame = async () => {
    try {
      await startBuyIn(buyInAmount);
      navigation.navigate('Gameplay');
    } catch {
      // error is already captured in the store; stay on this screen so the
      // player sees it rather than navigating away from a failed buy-in.
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.balance}>{displayedBalance === null ? '—' : displayedBalance.toLocaleString()}</Text>
        <View style={styles.backArrowSpacer} />
      </View>

      <View style={styles.center}>
        <Text style={styles.label}>Buy-in</Text>
        <Text style={styles.amount}>{buyInAmount.toLocaleString()}</Text>
        <DragSlider
          min={0}
          max={balance ?? DEFAULT_BUY_IN}
          value={buyInAmount}
          onChange={setBuyInAmount}
          width={windowWidth - spacing.s24 * 2}
        />
        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.footer}>
        <ActionButtons
          buttons={[
            {
              label: 'START GAME',
              onPress: handleStartGame,
              disabled: balance === null || isLoading || buyInAmount <= 0,
            },
          ]}
        />
      </View>
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
  balance: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 28,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    marginBottom: spacing.s8,
  },
  amount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 52,
    marginBottom: spacing.s32,
  },
  footer: {
    paddingHorizontal: spacing.s24,
    paddingBottom: spacing.s24,
  },
  error: {
    color: colors.negative,
    fontFamily: fontFamily.regular,
    fontSize: 14,
    marginTop: spacing.s24,
    textAlign: 'center',
  },
});
