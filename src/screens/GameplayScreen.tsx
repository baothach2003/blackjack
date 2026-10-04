import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActionButtons from '../components/ActionButtons';
import AnimatedNumber from '../components/AnimatedNumber';
import Card from '../components/Card';
import Chip from '../components/Chip';
import DealerArea from '../components/DealerArea';
import DragSlider from '../components/DragSlider';
import PlayerHand from '../components/PlayerHand';
import { RootStackParamList } from '../navigation/types';
import { useGameStore } from '../store/gameStore';
import { cardOverlap, colors, dealAnimation, fontFamily, radius, spacing } from '../theme/tokens';

// blackjack-app-spec.md section 5b Cancel Bet flow: the player's decorative
// card count shown in the 'waiting' idle state — matches a real starting
// hand's card count (2), even though these are never dealt/animated.
const WAITING_PLAYER_CARD_COUNT = 2;

const DEFAULT_BET = 50;
const DEFAULT_REBUY = 200;

type Navigation = NativeStackScreenProps<RootStackParamList>['navigation'];

export default function GameplayScreen() {
  const navigation = useNavigation<Navigation>();
  const { width: windowWidth } = useWindowDimensions();
  const sliderWidth = windowWidth - spacing.s24 * 2;

  const balance = useGameStore((s) => s.balance);
  const inPlay = useGameStore((s) => s.inPlay);
  const dealer = useGameStore((s) => s.dealer);
  const playerHands = useGameStore((s) => s.playerHands);
  const currentHandIndex = useGameStore((s) => s.currentHandIndex);
  const canDouble = useGameStore((s) => s.canDouble);
  const canSplit = useGameStore((s) => s.canSplit);
  const screenPhase = useGameStore((s) => s.screenPhase);
  const resultQueue = useGameStore((s) => s.resultQueue);
  const error = useGameStore((s) => s.error);
  const isLoading = useGameStore((s) => s.isLoading);

  const startRound = useGameStore((s) => s.startRound);
  const cancelBet = useGameStore((s) => s.cancelBet);
  const openPlaceBetSheet = useGameStore((s) => s.openPlaceBetSheet);
  const takeInsurance = useGameStore((s) => s.takeInsurance);
  const hit = useGameStore((s) => s.hit);
  const stand = useGameStore((s) => s.stand);
  const double = useGameStore((s) => s.double);
  const split = useGameStore((s) => s.split);
  const rebuy = useGameStore((s) => s.rebuy);
  const leaveTable = useGameStore((s) => s.leaveTable);
  const confirmLeaveTable = useGameStore((s) => s.confirmLeaveTable);

  const [betAmount, setBetAmount] = useState(DEFAULT_BET);
  const [rebuyAmount, setRebuyAmount] = useState(DEFAULT_REBUY);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // blackjack-app-spec.md section 5b: no Result overlay anymore — the In-Play
  // number's own color pulse is the settlement feedback. Net of every queued
  // hand's amount (matters for split: one hand can win while another loses),
  // signed for the color, zero (a clean push, or a split that cancels out)
  // for no color at all. resultQueue is cleared by the store's own
  // auto-transition once the settlement pause elapses, which naturally clears
  // this too.
  const settlementNet = resultQueue.reduce((sum, r) => sum + r.amount, 0);
  const inPlayPulseColor = resultQueue.length === 0 ? undefined : settlementNet > 0 ? 'positive' : settlementNet < 0 ? 'negative' : undefined;

  const isSplit = playerHands.length > 1;
  // blackjack-app-spec.md section 5b Cancel Bet flow: decorative "waiting at
  // table" state, no GameState/hand exists (game/dealer/playerHands stay
  // null/[]).
  const isWaiting = screenPhase === 'waiting';
  // blackjack-app-spec.md section 5b: mid-round phases are the ones where
  // confirming Leave Table forfeits the active hand(s) first.
  const isMidRound = screenPhase === 'playerTurn' || screenPhase === 'insurance' || screenPhase === 'dealerTurn';

  // Auto-scroll-to-active-hand for the split-hands row. Hand widths aren't
  // fixed (the fan/overlap layout means a hand's width grows with its card
  // count), so this measures each hand's real x-offset/width via onLayout
  // rather than assuming a uniform width — works the same regardless of how
  // many hands exist (split is unlimited per blackjack-app-spec.md 5b).
  const splitScrollRef = useRef<ScrollView>(null);
  const handLayoutsRef = useRef<Record<number, { x: number; width: number }>>({});
  const splitViewportWidth = windowWidth - spacing.s24 * 2;

  const scrollToHand = useCallback(
    (index: number) => {
      const layout = handLayoutsRef.current[index];
      if (!layout) return;
      // Center the hand in the viewport; ScrollView clamps the upper bound
      // itself, so only the lower bound needs guarding here.
      const target = layout.x - splitViewportWidth / 2 + layout.width / 2;
      splitScrollRef.current?.scrollTo({ x: Math.max(0, target), animated: true });
    },
    [splitViewportWidth],
  );

  useEffect(() => {
    if (isSplit) {
      scrollToHand(currentHandIndex);
    }
  }, [currentHandIndex, isSplit, scrollToHand]);

  // Stale measurements from a previous split (this round or an earlier one)
  // shouldn't linger once we're back to a single hand / no hand.
  useEffect(() => {
    if (!isSplit) {
      handLayoutsRef.current = {};
    }
  }, [isSplit]);

  const handleHandLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    handLayoutsRef.current[index] = { x, width };
    if (index === currentHandIndex) {
      // A newly-created (e.g. just-split) active hand's first layout arrives
      // after the currentHandIndex-triggered effect above already ran with
      // no measurement yet — this catches it up as soon as it's available.
      scrollToHand(index);
    }
  };

  // Detects the exact render where the dealer's hand first appears (the deal
  // just happened) so the initial 4 cards can slide in as one globally
  // sequential deal — player, dealer, player, dealer, matching real dealing
  // order — rather than each area staggering only against itself. Comparing
  // against a ref updated during render (not in an effect) is deliberate: it
  // needs to be known for THIS render's output, not one render late.
  const previousDealerRef = useRef(dealer);
  const isFreshDeal = previousDealerRef.current === null && dealer !== null && dealer.cards.length === 2;
  previousDealerRef.current = dealer;

  // Player's 2 cards land at global slots 0 and 2; the dealer's at 1 and 3
  // (docs/blackjack-game-logic.md section 3: "dealer deals 2 cards to each
  // side," dealt player/dealer/player/dealer). Only meaningful for the
  // single (non-split) hand — a fresh deal never starts already split.
  const playerDealDelays = isFreshDeal ? [0, 2 * dealAnimation.staggerMs] : undefined;
  const dealerDealDelays = isFreshDeal
    ? [dealAnimation.staggerMs, 3 * dealAnimation.staggerMs]
    : undefined;

  // No active session (e.g. this screen reached directly) — nothing to play.
  useEffect(() => {
    if (screenPhase === 'idle') {
      navigation.navigate('MainTabs');
    }
  }, [screenPhase, navigation]);

  // Keep the default bet/rebuy amounts sane once real In-Play/Balance are known.
  useEffect(() => {
    if (inPlay !== null) {
      setBetAmount((current) => Math.min(Math.max(current, 1), Math.max(inPlay, 1)));
    }
  }, [inPlay]);
  useEffect(() => {
    if (balance !== null) {
      setRebuyAmount((current) => Math.min(current, Math.max(balance, 1)));
    }
  }, [balance]);

  const showActionButtons = screenPhase === 'playerTurn' || screenPhase === 'insurance';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => setShowLeaveConfirm(true)} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.title}>Blackjack</Text>
        <Chip amount={balance ?? 0} animated />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {/* blackjack-app-spec.md section 5b: the Place Bet Sheet (and the
            mid-game Buy-in Sheet) render over the live, dimly-visible empty
            table — dealer waiting, no cards — same treatment as the Result
            overlay, not an opaque background. That requires the dealer area
            to actually exist behind the sheet even before a round starts, so
            this is no longer gated on `dealer` being non-null. */}
        <DealerArea
          cards={dealer?.cards ?? []}
          holeRevealed={dealer?.holeRevealed ?? false}
          visibleTotal={dealer?.visibleTotal}
          dealDelays={dealerDealDelays}
          decorativeCount={isWaiting ? WAITING_PLAYER_CARD_COUNT : undefined}
        />

        {/* blackjack-app-spec.md section 5b: the In-Play panel must stay
            visible regardless of split state — same position/treatment
            either way, not a split-only or non-split-only element. Both
            layouts share this one wrapping row so the panel isn't
            duplicated or reimplemented per branch. Also shown in the
            Cancel-Bet 'waiting' state (decorative cards, still a real
            In-Play number worth seeing) alongside playerHands.length > 0. */}
        {(playerHands.length > 0 || isWaiting) && (
          <View style={styles.playerRow}>
            {isWaiting ? (
              // Purely decorative — no CardData, always face-down, no
              // deal-in animation, no total. Card.tsx already renders a
              // face-down back when `card` is omitted.
              <View style={styles.waitingCards}>
                {Array.from({ length: WAITING_PLAYER_CARD_COUNT }, (_, index) => (
                  <View key={index} style={index > 0 ? { marginLeft: cardOverlap.normal } : undefined}>
                    <Card faceDown />
                  </View>
                ))}
              </View>
            ) : isSplit ? (
              // blackjack-app-spec.md section 3.7: split limit is unlimited
              // (section 5b), so this has to scroll rather than assume 2-4
              // hands fit on screen. Horizontal, not vertical — matches the
              // "Split Hands - 3 Hands (Scroll)" mockup and section 3.7's
              // explicit "horizontally scrollable container." flex:1 (not
              // the hands' natural content width) so the ScrollView shares
              // the row with the fixed-size In-Play panel instead of
              // pushing it off-screen — the panel sits outside the
              // scrollable area, so it never scrolls away with the hands.
              <ScrollView
                ref={splitScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.splitRow}
                style={styles.splitScroll}
              >
                {playerHands.map((hand, index) => (
                  <View key={index} onLayout={handleHandLayout(index)}>
                    <PlayerHand
                      variant="split"
                      label={`HAND ${index + 1}`}
                      isActive={index === currentHandIndex}
                      dimmed={index !== currentHandIndex}
                      cards={hand.cards}
                      total={hand.total}
                    />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <PlayerHand
                cards={playerHands[0].cards}
                total={playerHands[0].total}
                dealDelays={playerDealDelays}
              />
            )}
            <View style={styles.inPlayPanel}>
              <Text style={styles.inPlayLabel}>In-Play</Text>
              {/* Not explicitly named in blackjack-app-spec.md section 5b's
                  example list, but it's the same category of "chip value
                  that changes as a result of a game action" (settlement) —
                  treating the list as illustrative, not exhaustive. Also
                  now the sole settlement feedback (section 5b supersedes
                  3.10's Result overlay): green while counting up on a
                  win/blackjack, red while counting down on a loss, no
                  color for a push. */}
              <AnimatedNumber
                value={inPlay ?? 0}
                style={styles.inPlayAmount}
                pulseColor={inPlayPulseColor}
                baseColor={colors.textPrimary}
              />
            </View>
          </View>
        )}

        {isWaiting && (
          // blackjack-app-spec.md section 5b Cancel Bet flow: replaces
          // Hit/Stand/Double entirely while waiting — a single full-width
          // bar (ActionButtons already stretches to fill the row for a
          // single button, same as BuyInScreen's "START GAME") that reopens
          // the Place Bet Sheet.
          <View style={styles.actionArea}>
            <ActionButtons buttons={[{ label: 'Place Bet', onPress: openPlaceBetSheet }]} />
          </View>
        )}

        {showActionButtons && (
          <View style={styles.actionArea}>
            {screenPhase === 'insurance' ? (
              <ActionButtons
                buttons={[
                  { label: 'Insurance Yes', onPress: () => takeInsurance(true) },
                  { label: 'Insurance No', onPress: () => takeInsurance(false) },
                ]}
              />
            ) : (
              <ActionButtons
                buttons={[
                  { label: 'Hit', onPress: () => void hit() },
                  { label: 'Stand', onPress: () => void stand() },
                  { label: 'Double', onPress: () => void double(), disabled: !canDouble },
                  // blackjack-app-spec.md section 5b: Split is an animated
                  // 4th button, not a disabled placeholder — it only exists
                  // in the row at all when the active hand is split-
                  // eligible, so ActionButtons' entering/exiting/layout
                  // transitions actually animate it in and out. Declining is
                  // just tapping Hit/Stand/Double directly; there is no
                  // separate "Don't Split" button.
                  ...(canSplit ? [{ label: 'Split', onPress: () => void split() }] : []),
                ]}
              />
            )}
          </View>
        )}
      </ScrollView>

      {error !== null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <BottomSheet visible={screenPhase === 'betting' && !showLeaveConfirm}>
        <Text style={styles.sheetTitle}>Place your bet</Text>
        <Text style={styles.sheetSubtitle}>You have {inPlay ?? 0} in play</Text>
        <Text style={styles.sheetAmount}>{betAmount}</Text>
        <DragSlider
          min={1}
          max={Math.max(inPlay ?? 1, 1)}
          value={betAmount}
          onChange={setBetAmount}
          width={sliderWidth}
        />
        <ActionButtons
          buttons={[
            {
              label: 'Place Bet',
              onPress: () => void startRound(betAmount),
              disabled: isLoading || betAmount <= 0,
            },
          ]}
        />
        {/* blackjack-app-spec.md section 5b Cancel Bet flow: secondary
            action, doesn't replace "Place Bet" above — same outlined/
            underlined treatment already used for "Leave The Table" and the
            Leave-confirm sheet's own "Cancel" below. */}
        <Pressable style={styles.leaveButton} onPress={cancelBet}>
          <Text style={styles.leaveButtonText}>Cancel</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={screenPhase === 'buyInSheet' && !showLeaveConfirm}>
        <Text style={styles.sheetTitle}>Buy into game</Text>
        <Text style={styles.sheetSubtitle}>You have {balance ?? 0} chips</Text>
        <Text style={styles.sheetAmount}>{rebuyAmount}</Text>
        <DragSlider
          min={1}
          max={Math.max(balance ?? 1, 1)}
          value={rebuyAmount}
          onChange={setRebuyAmount}
          width={sliderWidth}
        />
        <ActionButtons
          buttons={[
            {
              label: 'Buy-in',
              onPress: () => void rebuy(rebuyAmount),
              disabled: isLoading || rebuyAmount <= 0,
            },
          ]}
        />
        <Pressable
          style={styles.leaveButton}
          onPress={() => {
            void (async () => {
              await leaveTable();
              navigation.navigate('MainTabs');
            })();
          }}
        >
          <Text style={styles.leaveButtonText}>Leave The Table</Text>
        </Pressable>
      </BottomSheet>

      {/* blackjack-app-spec.md section 5b: Leave Table is available anytime,
          including mid-hand, via this confirmation sheet — triggered by the
          header back button in any game phase, no phase guard blocking it. */}
      <BottomSheet visible={showLeaveConfirm}>
        <Text style={styles.sheetTitle}>Are you sure to leave the table?</Text>
        {isMidRound && (
          <Text style={styles.sheetSubtitle}>Your current hand will be forfeited.</Text>
        )}
        <ActionButtons
          buttons={[
            {
              label: 'Leave Table',
              onPress: () => {
                setShowLeaveConfirm(false);
                void confirmLeaveTable();
              },
              disabled: isLoading,
            },
          ]}
        />
        <Pressable style={styles.leaveButton} onPress={() => setShowLeaveConfirm(false)}>
          <Text style={styles.leaveButtonText}>Cancel</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

function BottomSheet({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  if (!visible) return null;
  return (
    <View style={styles.sheetBackdrop}>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        {children}
      </View>
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
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 22,
  },
  scroll: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.s24,
    paddingTop: spacing.s24,
    paddingBottom: spacing.s16,
  },
  splitScroll: {
    flex: 1,
  },
  splitRow: {
    flexDirection: 'row',
    gap: spacing.s16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.s32,
  },
  waitingCards: {
    flexDirection: 'row',
  },
  inPlayPanel: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.card,
    paddingVertical: spacing.s16,
    paddingHorizontal: spacing.s24,
    alignItems: 'center',
  },
  inPlayLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    marginBottom: spacing.s8,
  },
  inPlayAmount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 24,
  },
  actionArea: {
    flex: 1,
    justifyContent: 'center',
  },
  errorBanner: {
    paddingHorizontal: spacing.s24,
    paddingBottom: spacing.s8,
  },
  errorText: {
    color: colors.negative,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13, 13, 15, 0.75)',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.s24,
    paddingTop: spacing.s16,
    paddingBottom: spacing.s32,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
    marginBottom: spacing.s24,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 22,
    marginBottom: spacing.s8,
  },
  sheetSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    marginBottom: spacing.s24,
  },
  sheetAmount: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bold,
    fontSize: 44,
    marginBottom: spacing.s24,
  },
  leaveButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.s16,
    alignItems: 'center',
    marginTop: spacing.s16,
  },
  leaveButtonText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.medium,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
