import { colors, fonts, type } from '@/src/theme';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  title: string;
  kicker?: string;
  subtitle?: string;
  showBack?: boolean;
  scroll?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
  contentStyle?: ViewStyle;
};

/** Shared Lords of Minecraft chrome: panorama, kickers, titles, spacing. */
export function ScreenShell({
  title,
  kicker = 'Lords of Minecraft',
  subtitle,
  showBack = false,
  scroll = true,
  footer,
  children,
  contentStyle,
}: Props) {
  const body = (
    <>
      <Animated.View entering={FadeInDown.duration(450)}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
            hitSlop={12}
          >
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        ) : null}
        <Text style={type.kicker}>{kicker}</Text>
        <Text style={type.title}>{title}</Text>
        {subtitle ? <Text style={[type.subtitle, styles.subtitle]}>{subtitle}</Text> : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(450)} style={styles.main}>
        {children}
      </Animated.View>

      {footer ? (
        <Animated.View entering={FadeInDown.delay(180).duration(450)} style={styles.footer}>
          {footer}
        </Animated.View>
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill, contentStyle]}>{body}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },
  back: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    paddingVertical: 4,
  },
  backPressed: { opacity: 0.7 },
  backText: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: colors.brass,
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 4,
  },
  main: {
    marginTop: 28,
    gap: 12,
    flexGrow: 1,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 36,
  },
  panel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 4,
    padding: 18,
    gap: 8,
  },
});
