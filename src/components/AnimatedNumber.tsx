import { ComponentType, useEffect, useRef } from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle } from 'react-native';
import Animated, {
  AnimatedProps,
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/tokens';

// `text` is a real native TextInput prop reanimated can update directly on
// the UI thread (the standard workaround for animating text content, since
// core RN's <Text> has no equivalent) — it's just not part of RN's public
// TextInputProps type, so the animated-component wrapper needs a cast to
// know about it.
interface AnimatedTextInputProps extends TextInputProps {
  text?: string;
}
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput) as unknown as ComponentType<
  AnimatedProps<AnimatedTextInputProps>
>;

const DURATION_MS = 400;

// Manual thousands-separator formatting, not Number.prototype.toLocaleString
// — this runs inside a reanimated worklet (a stripped-down JS VM on the UI
// thread) that doesn't reliably support Intl/toLocaleString, so it has to be
// worklet-safe on its own using only basic string/number operations. Also
// directly unit-testable as plain JS (see __tests__), independent of
// reanimated/rendering.
export function formatWithCommas(n: number): string {
  'worklet';
  const rounded = Math.round(n);
  const isNegative = rounded < 0;
  const digits = String(Math.abs(rounded));
  let result = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      result += ',';
    }
    result += digits[i];
  }
  return (isNegative ? '-' : '') + result;
}

// Prepends "+" for values >= 0 (negative values already show their own "-"
// from formatWithCommas) — e.g. a signed settlement amount, "+0" for a push.
// No current caller passes `signed: true` (its one caller, the Result
// overlay, was removed per blackjack-app-spec.md 5b) — kept as a still-
// tested, reusable capability of this shared component rather than deleted
// along with it.
export function formatSignedAmount(n: number, signed: boolean): string {
  'worklet';
  const formatted = formatWithCommas(n);
  return signed && Math.round(n) >= 0 ? `+${formatted}` : formatted;
}

export type PulseColor = 'positive' | 'negative';

const PULSE_HEX: Record<PulseColor, string> = {
  positive: colors.accent,
  negative: colors.negative,
};

export interface AnimatedNumberProps {
  value: number;
  style?: StyleProp<TextStyle>;
  signed?: boolean;
  // blackjack-app-spec.md section 5b (post-Result-overlay-removal): the
  // In-Play display carries its own win/loss cue now — green while counting
  // up on a win/blackjack payout, red while counting down on a loss, no
  // color for a push. Both props are required together to opt in; omit both
  // for a plain count with no color cue (Balance, Buy-in confirmation,
  // etc.). `baseColor` is the color to settle back to once the pulse fades —
  // the caller's own static text color, since this component has no way to
  // read it back out of an arbitrary `style` prop.
  pulseColor?: PulseColor;
  baseColor?: string;
}

// docs/blackjack-app-spec.md section 5b: "Animated number counting... any UI
// element where a chip/money value changes... should count up/down through
// intermediate values rather than snapping instantly." One shared component,
// not bespoke per-screen logic. Reassigning a shared value's .value to a new
// withTiming() while a previous one is still running is reanimated's own
// built-in interruption handling (it retargets smoothly from the current
// in-flight value) — nothing bespoke needed here for that case.
export default function AnimatedNumber({ value, style, signed = false, pulseColor, baseColor }: AnimatedNumberProps) {
  const animatedValue = useSharedValue(value);
  const colorIntensity = useSharedValue(0);
  // Guards the color pulse only — never fire it for the value a component
  // mounts with (there's nothing to compare against yet), only for changes
  // after that. The number's own count is a harmless no-op on first mount
  // either way (animatedValue is already initialized to `value`), so it
  // doesn't need the same guard.
  const isFirstRender = useRef(true);

  useEffect(() => {
    animatedValue.value = withTiming(value, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) });
    if (!isFirstRender.current && pulseColor) {
      colorIntensity.value = 1;
      colorIntensity.value = withTiming(0, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) });
    }
    isFirstRender.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const animatedProps = useAnimatedProps<AnimatedTextInputProps>(() => {
    return { text: formatSignedAmount(animatedValue.value, signed) };
  });

  const animatedColorStyle = useAnimatedStyle(() => {
    if (!pulseColor || !baseColor) return {};
    return { color: interpolateColor(colorIntensity.value, [0, 1], [baseColor, PULSE_HEX[pulseColor]]) };
  });

  return (
    <AnimatedTextInput
      style={[styles.base, style, animatedColorStyle]}
      editable={false}
      showSoftInputOnFocus={false}
      caretHidden
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      defaultValue={formatSignedAmount(value, signed)}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
});
