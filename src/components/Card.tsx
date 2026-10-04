import { useEffect } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Card as CardData, Rank, Suit } from '../game/types';
import { cardElevation, cardSize, dealAnimation, radius } from '../theme/tokens';

// Metro requires static string literals — can't build this path dynamically
// from rank/suit, so every clean-named asset (per CLAUDE.md section 8) gets
// its own literal require() here.
const FACES: Record<string, ReturnType<typeof require>> = {
  '2H': require('../../assets/cards/2H.png'),
  '2D': require('../../assets/cards/2D.png'),
  '2C': require('../../assets/cards/2C.png'),
  '2S': require('../../assets/cards/2S.png'),
  '3H': require('../../assets/cards/3H.png'),
  '3D': require('../../assets/cards/3D.png'),
  '3C': require('../../assets/cards/3C.png'),
  '3S': require('../../assets/cards/3S.png'),
  '4H': require('../../assets/cards/4H.png'),
  '4D': require('../../assets/cards/4D.png'),
  '4C': require('../../assets/cards/4C.png'),
  '4S': require('../../assets/cards/4S.png'),
  '5H': require('../../assets/cards/5H.png'),
  '5D': require('../../assets/cards/5D.png'),
  '5C': require('../../assets/cards/5C.png'),
  '5S': require('../../assets/cards/5S.png'),
  '6H': require('../../assets/cards/6H.png'),
  '6D': require('../../assets/cards/6D.png'),
  '6C': require('../../assets/cards/6C.png'),
  '6S': require('../../assets/cards/6S.png'),
  '7H': require('../../assets/cards/7H.png'),
  '7D': require('../../assets/cards/7D.png'),
  '7C': require('../../assets/cards/7C.png'),
  '7S': require('../../assets/cards/7S.png'),
  '8H': require('../../assets/cards/8H.png'),
  '8D': require('../../assets/cards/8D.png'),
  '8C': require('../../assets/cards/8C.png'),
  '8S': require('../../assets/cards/8S.png'),
  '9H': require('../../assets/cards/9H.png'),
  '9D': require('../../assets/cards/9D.png'),
  '9C': require('../../assets/cards/9C.png'),
  '9S': require('../../assets/cards/9S.png'),
  TH: require('../../assets/cards/TH.png'),
  TD: require('../../assets/cards/TD.png'),
  TC: require('../../assets/cards/TC.png'),
  TS: require('../../assets/cards/TS.png'),
  JH: require('../../assets/cards/JH.png'),
  JD: require('../../assets/cards/JD.png'),
  JC: require('../../assets/cards/JC.png'),
  JS: require('../../assets/cards/JS.png'),
  QH: require('../../assets/cards/QH.png'),
  QD: require('../../assets/cards/QD.png'),
  QC: require('../../assets/cards/QC.png'),
  QS: require('../../assets/cards/QS.png'),
  KH: require('../../assets/cards/KH.png'),
  KD: require('../../assets/cards/KD.png'),
  KC: require('../../assets/cards/KC.png'),
  KS: require('../../assets/cards/KS.png'),
  AH: require('../../assets/cards/AH.png'),
  AD: require('../../assets/cards/AD.png'),
  AC: require('../../assets/cards/AC.png'),
  AS: require('../../assets/cards/AS.png'),
};

const BACK = require('../../assets/cards/back.png');

const RANK_CODE: Record<Rank, string> = {
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': 'T',
  J: 'J',
  Q: 'Q',
  K: 'K',
  A: 'A',
};

const SUIT_CODE: Record<Suit, string> = {
  Hearts: 'H',
  Diamonds: 'D',
  Clubs: 'C',
  Spades: 'S',
};

export type CardVariant = 'normal' | 'split';

export interface CardProps {
  card?: CardData;
  faceDown?: boolean;
  variant?: CardVariant;
  // Delay (ms) before this card's deal-in slide starts, for staggering
  // multiple cards dealt in the same batch. Only affects the initial
  // slide-in on mount — later prop changes (e.g. the hole card being
  // revealed) never replay it; that's the separate flip animation, not built yet.
  dealDelayMs?: number;
}

export default function Card({ card, faceDown = false, variant = 'normal', dealDelayMs = 0 }: CardProps) {
  const { width, height } = cardSize[variant];
  const { width: windowWidth } = useWindowDimensions();
  const source = faceDown || !card ? BACK : FACES[`${RANK_CODE[card.rank]}${SUIT_CODE[card.suit]}`];

  // Starts off-screen to the left regardless of where this card's normal
  // flex layout actually places it — translating by -windowWidth from any
  // on-screen resting position guarantees the start is at or past the left
  // edge, without needing to measure this card's absolute screen position.
  const translateX = useSharedValue(-windowWidth);

  useEffect(() => {
    translateX.value = withDelay(
      dealDelayMs,
      withTiming(0, { duration: dealAnimation.durationMs, easing: Easing.out(Easing.cubic) }),
    );
    // Deal-in plays once, on mount, only — must not restart on later prop
    // changes (e.g. faceDown flipping when the hole card is revealed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[{ width, height }, cardElevation, animatedStyle]}>
      <View style={styles.clip}>
        <Image source={source} style={styles.image} resizeMode="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Shadow (cardElevation, on the outer View) and overflow:hidden don't mix on
  // iOS — the inner View clips the rounded image, the outer one casts the shadow.
  clip: {
    flex: 1,
    borderRadius: radius.playingCard,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
