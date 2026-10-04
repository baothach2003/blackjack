import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { colors, fontFamily, radius, spacing } from '../theme/tokens';

export interface ActionButtonConfig {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export interface ActionButtonsProps {
  buttons: ActionButtonConfig[];
}

const TRANSITION_DURATION_MS = 250;

// Button/Pill component from the design tokens: Default / Pressed / Disabled
// states. The caller decides what the row of buttons means and how many
// there are — Hit/Stand/Double, Insurance Yes/No, a single confirm button,
// etc. Each button is wrapped in its own Animated.View with a `layout`
// transition, so when the caller's `buttons` array itself changes length
// (blackjack-app-spec.md section 5b: the Split button mounting/unmounting
// per-hand, not just toggling disabled) every pill smoothly resizes to its
// new share of the row instead of snapping, and the entering/exiting pill
// fades in/out rather than popping.
export default function ActionButtons({ buttons }: ActionButtonsProps) {
  return (
    <View style={styles.row}>
      {buttons.map((button) => (
        <Animated.View
          key={button.label}
          layout={LinearTransition.duration(TRANSITION_DURATION_MS)}
          entering={FadeIn.duration(TRANSITION_DURATION_MS)}
          exiting={FadeOut.duration(TRANSITION_DURATION_MS)}
          style={styles.pillWrapper}
        >
          <Pressable
            onPress={button.onPress}
            disabled={button.disabled}
            style={({ pressed }) => [
              styles.pill,
              button.disabled && styles.pillDisabled,
              pressed && !button.disabled && styles.pillPressed,
            ]}
          >
            <Text style={[styles.label, button.disabled && styles.labelDisabled]}>{button.label}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.s8,
    // Without this, a parent that sets alignItems: 'center' (GameplayScreen's
    // `sheet`, shared by the Place Bet / Buy-in / Leave Table sheets) makes
    // this row shrink-wrap to its own content instead of filling the
    // parent's width. That leaves the flex:1 pills below nothing to grow
    // into, so their content-box collapses to near-zero and the label text
    // has no room to render — the pill still paints (padding alone gives it
    // a sliver of area) but the text doesn't. `actionArea` (Hit/Stand/
    // Double/Split) never hit this because it doesn't override alignItems,
    // so it was already stretch by default.
    alignSelf: 'stretch',
  },
  pillWrapper: {
    flex: 1,
    // Fixed height, pinned on this node AND `pill` below. Bug history: a
    // single-button row (e.g. BuyInScreen's "START GAME") could render at
    // 0-49px height depending on render timing — content-derived sizing
    // racing against this node's own `layout`/`entering`/`exiting` mount
    // animation above. Giving only the inner `pill` (a plain, non-animated
    // Pressable) an explicit height wasn't enough, since `pillWrapper` — the
    // actual animated node — was still unpinned and could constrain it.
    // Pinning both nodes to the same static 49 removed all content-derived
    // sizing from the chain; confirmed fixed via device logs (no more
    // 0-height renders on any button, single or multi).
    height: 49,
  },
  pill: {
    flex: 1,
    // See `pillWrapper` above — height is pinned on both this node and its
    // animated parent. 49 matches the pill's real content height (padding +
    // a 17px text line) that was already correct whenever the race above
    // didn't hit.
    height: 49,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    // Root cause of the wrapping bug: spacing.s24 (24px) horizontal padding
    // per side, plus a 16px gap, left too little width for "Double"/"Stand"
    // once 3-4 buttons share a row with flex:1 — the padding didn't shrink
    // with the button, it just ate more of an already-compressed width.
    paddingHorizontal: spacing.s8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPressed: {
    backgroundColor: colors.accentPressed,
  },
  pillDisabled: {
    backgroundColor: colors.disabledBg,
  },
  label: {
    color: colors.accentOn,
    fontFamily: fontFamily.semiBold,
    // Down from 16px, the other half of the actual fix — at 16px, "Double"
    // still didn't reliably fit a 4-button row's share of the width even
    // after tightening padding/gap above, especially on narrower devices.
    fontSize: 14,
    // Explicit, not left to font-metric auto-sizing — a Text's height
    // shouldn't depend on font-metric timing. Not itself the fix for the
    // invisible-text bug (that was `pill`/`pillWrapper`'s height — see those
    // styles' comments), just still-correct practice on its own.
    lineHeight: 17,
  },
  labelDisabled: {
    color: colors.disabledText,
  },
});
