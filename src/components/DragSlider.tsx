import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

export interface DragSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  width: number;
  step?: number;
  tickCount?: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// A real free-drag slider: the tick marks are purely decorative reference
// points, not snap targets — the drag itself is continuous, per pixel. Built
// on core RN PanResponder rather than pulling in a slider dependency.
//
// onChange (and the resulting parent re-render) only fires when the drag
// crosses a new multiple of `step`, deduped against the last committed value
// — most pixel-level move events resolve to the same rounded number and
// produce zero re-renders. The thumb still tracks the raw, unrounded drag
// position via local `dragValue` state (scoped to this component alone), so
// it keeps following the finger smoothly without waiting for the stepped
// value. Shared by BuyInScreen, the Place Bet Sheet, and the mid-game
// Buy-in Sheet — all three want the same continuous-drag-with-stepped-commit
// behavior.
export default function DragSlider({ min, max, value, onChange, width, step = 100, tickCount = 21 }: DragSliderProps) {
  const roundToStep = (n: number) => Math.round(n / step) * step;

  const [dragValue, setDragValue] = useState(value);

  // Refs so the PanResponder (created once) always reads the latest
  // props/bounds without needing to be recreated mid-gesture.
  const valueRef = useRef(value);
  valueRef.current = value;
  const boundsRef = useRef({ min, max, width, step });
  boundsRef.current = { min, max, width, step };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const startValueRef = useRef(value);
  const lastCommittedRef = useRef(roundToStep(value));

  // If `value` changes from outside while not dragging, keep the thumb synced.
  useEffect(() => {
    setDragValue(value);
    lastCommittedRef.current = roundToStep(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValueRef.current = valueRef.current;
      },
      onPanResponderMove: (_event, gestureState) => {
        const { min, max, width, step: currentStep } = boundsRef.current;
        const deltaRatio = gestureState.dx / width;
        const raw = clamp(startValueRef.current + deltaRatio * (max - min), min, max);

        setDragValue(raw);

        const stepped = clamp(Math.round(raw / currentStep) * currentStep, min, max);
        if (stepped !== lastCommittedRef.current) {
          lastCommittedRef.current = stepped;
          onChangeRef.current(stepped);
        }
      },
    }),
  ).current;

  const ratio = (dragValue - min) / (max - min);
  const thumbLeft = ratio * width;

  return (
    <View style={[styles.touchArea, { width }]} {...panResponder.panHandlers}>
      <View style={styles.tickRow}>
        {Array.from({ length: tickCount }, (_, index) => (
          <View key={index} style={styles.tick} />
        ))}
      </View>
      <View style={[styles.thumb, { left: thumbLeft - THUMB_SIZE / 2 }]} />
    </View>
  );
}

const THUMB_SIZE = 20;

const styles = StyleSheet.create({
  touchArea: {
    height: 44,
    justifyContent: 'center',
  },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tick: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: colors.textSecondary,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.textPrimary,
  },
});
