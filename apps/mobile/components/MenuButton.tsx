import { colors, fonts } from '@/src/theme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
  label: string;
  onPress: () => void;
  subtle?: boolean;
};

export function MenuButton({ label, onPress, subtle }: Props) {
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));

  return (
    <Animated.View style={anim}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 120 });
        }}
        style={({ pressed: isPressed }) => [
          styles.button,
          subtle && styles.subtle,
          isPressed && styles.pressed,
        ]}
      >
        <Text style={[styles.label, subtle && styles.subtleLabel]}>{label}</Text>
        <View style={styles.chevron}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtle: {
    backgroundColor: 'rgba(243, 237, 226, 0.72)',
  },
  pressed: {
    borderColor: colors.brass,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    color: colors.ink,
    letterSpacing: 0.2,
  },
  subtleLabel: {
    color: colors.moss,
  },
  chevron: {
    marginLeft: 12,
  },
  chevronText: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.brassDeep,
    lineHeight: 24,
  },
});
