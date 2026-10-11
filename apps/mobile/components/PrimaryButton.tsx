import { colors, fonts } from '@/src/theme';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: 'brass' | 'danger';
};

export function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
  tone = 'brass',
}: Props) {
  const danger = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        styles.base,
        danger ? styles.danger : styles.brass,
        pressed && (danger ? styles.dangerPressed : styles.brassPressed),
        (busy || disabled) && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.parchment} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  brass: { backgroundColor: colors.brassDeep },
  brassPressed: { backgroundColor: colors.brass },
  danger: { backgroundColor: colors.danger },
  dangerPressed: { opacity: 0.88 },
  disabled: { opacity: 0.7 },
  label: {
    fontFamily: fonts.displayRegular,
    fontSize: 18,
    color: colors.parchment,
    letterSpacing: 0.8,
  },
});
