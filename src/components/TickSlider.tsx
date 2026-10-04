import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

export interface TickSliderProps {
  tickCount?: number;
  selectedIndex: number;
  dangerStartIndex?: number;
}

// Static visual mock of the tick-mark slider used on Buy-in, the mid-game
// Buy-in Sheet, and the Place Bet Sheet (blackjack-app-spec.md 3.2/3.4/3.5).
// Phase 3 is static UI only — this renders the selected tick, it doesn't drag.
export default function TickSlider({ tickCount = 9, selectedIndex, dangerStartIndex = tickCount - 2 }: TickSliderProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: tickCount }, (_, index) => {
        const isSelected = index === selectedIndex;
        const isDanger = index >= dangerStartIndex;
        return (
          <View
            key={index}
            style={[
              styles.tick,
              isSelected && styles.tickSelected,
              isDanger && !isSelected && styles.tickDanger,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  tick: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: colors.textSecondary,
  },
  tickSelected: {
    width: 3,
    height: 32,
    backgroundColor: colors.textPrimary,
  },
  tickDanger: {
    backgroundColor: colors.negative,
  },
});
