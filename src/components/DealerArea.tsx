import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Card as CardData } from '../game/types';
import { cardOverlap, colors, dealAnimation, fontFamily, spacing } from '../theme/tokens';
import Card from './Card';

function DealerIcon() {
  return (
    <Svg width={100} height={100} viewBox="0 0 100 100">
      <Circle cx={50} cy={28} r={22} stroke={colors.accent} strokeWidth={4} fill="none" />
      <Path
        d="M20,92 C20,60 33,52 50,52 C67,52 80,60 80,92"
        stroke={colors.accent}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M20,92 L11,96" stroke={colors.accent} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M80,92 L89,96" stroke={colors.accent} strokeWidth={4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export interface DealerAreaProps {
  // Convention: cards[0] is always the visible up-card, cards[1] is the hole
  // card (face-down until holeRevealed), cards[2+] are the dealer's own hits
  // — only ever present once holeRevealed is true, since they're only dealt
  // during the dealer's own turn per docs/blackjack-game-logic.md section 5.
  cards: CardData[];
  holeRevealed?: boolean;
  // Omit entirely for the "waiting, no cards dealt yet" state (the live,
  // dimly-visible table behind the Place Bet Sheet — blackjack-app-spec.md
  // section 5b) — cards will be [] in that case too, and no total renders.
  visibleTotal?: number;
  // Explicit per-card deal-in stagger delays (ms) — used for the initial
  // deal, where the dealer's cards interleave with the player's in one
  // global sequence (see GameplayScreen). Leave unset for the dealer's own
  // hits during dealerTurn, where the auto-stagger below is already correct.
  dealDelays?: number[];
  // blackjack-app-spec.md section 5b Cancel Bet flow: when there's no real
  // dealer hand yet (`cards` is empty) but the screen should still show a
  // "waiting at table" look, render this many purely decorative face-down
  // cards instead — no CardData backing them, no deal-in animation, always
  // face-down regardless of index (unlike a real hand's up-card at index 0).
  // Ignored once `cards` is non-empty (a real hand takes over).
  decorativeCount?: number;
}

// blackjack-app-spec.md section 3.3: dealer icon + "DEALER" label + the dealt
// cards (hole card face-down until holeRevealed) + the visible total, which
// only counts the face-up card(s) per standard Blackjack rules. Uses the same
// fan/overlap treatment as PlayerHand once there are 3+ cards (the dealer
// hitting during their own turn).
export default function DealerArea({
  cards,
  holeRevealed = false,
  visibleTotal,
  dealDelays,
  decorativeCount,
}: DealerAreaProps) {
  // Auto-stagger: only cards added since the last render (the dealer hitting
  // during dealerTurn, possibly more than once in the same update) get a
  // nonzero delay, so each is individually visible rather than all appearing
  // at once — see docs/project-plan.md Phase 5.
  const previousCardCountRef = useRef(0);
  const autoDelays = cards.map((_, index) =>
    index >= previousCardCountRef.current ? (index - previousCardCountRef.current) * dealAnimation.staggerMs : 0,
  );
  useEffect(() => {
    previousCardCountRef.current = cards.length;
  }, [cards.length]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>DEALER</Text>
      <DealerIcon />
      <View style={styles.cardRow}>
        <View style={styles.cards}>
          {cards.length > 0
            ? cards.map((card, index) => (
                <View
                  key={`${card.rank}-${card.suit}-${index}`}
                  style={index > 0 ? { marginLeft: cardOverlap.normal } : undefined}
                >
                  <Card
                    card={card}
                    faceDown={index === 1 && !holeRevealed}
                    dealDelayMs={dealDelays?.[index] ?? autoDelays[index]}
                  />
                </View>
              ))
            : decorativeCount
              ? Array.from({ length: decorativeCount }, (_, index) => (
                  <View
                    key={`decorative-${index}`}
                    style={index > 0 ? { marginLeft: cardOverlap.normal } : undefined}
                  >
                    <Card faceDown />
                  </View>
                ))
              : null}
        </View>
        {visibleTotal !== undefined && <Text style={styles.total}>{visibleTotal}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: spacing.s8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.s16,
  },
  cards: {
    flexDirection: 'row',
  },
  total: {
    color: colors.textPrimary,
    fontFamily: fontFamily.regular,
    fontSize: 28,
    marginLeft: spacing.s24,
  },
});
