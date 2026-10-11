import { PrimaryButton } from '@/components/PrimaryButton';
import { useLink } from '@/src/auth/LinkContext';
import { colors, fonts } from '@/src/theme';
import { isLinkCode, normalizeLinkCode } from '@/src/util/crockford';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const { session, linkWithCode } = useLink();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logoScale = useSharedValue(0.92);

  useEffect(() => {
    if (session) router.replace('/(app)/home');
  }, [session]);

  useEffect(() => {
    logoScale.value = withTiming(1, { duration: 900 });
  }, [logoScale]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  async function onLink() {
    setError(null);
    const normalized = normalizeLinkCode(code);
    if (!isLinkCode(normalized)) {
      setError('Use the 10-character code from /lomphone link in-game.');
      return;
    }
    setBusy(true);
    try {
      await linkWithCode(normalized);
      router.replace('/(app)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link this device.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Animated.View entering={FadeIn.duration(700)} style={[styles.logoWrap, logoStyle]}>
                <Image
                  source={require('../assets/brand/logo.png')}
                  style={styles.logo}
                  accessibilityLabel="Lords of Minecraft"
                />
              </Animated.View>
              <Animated.Text entering={FadeInDown.delay(180).duration(650)} style={styles.brand}>
                Lords of Minecraft
              </Animated.Text>
              <Animated.Text entering={FadeInDown.delay(320).duration(650)} style={styles.tagline}>
                In Minecraft, run{' '}
                <Text style={styles.command}>/lomphone link</Text>
                , then enter the private code below.
              </Animated.Text>
            </View>

            <Animated.View entering={FadeInDown.delay(480).duration(650)} style={styles.form}>
              <Text style={styles.label}>Link code</Text>
              <TextInput
                value={code}
                onChangeText={(value) => {
                  setCode(value.toUpperCase());
                  setError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={14}
                placeholder="XXXXXXXXXX"
                placeholderTextColor="rgba(14,28,26,0.35)"
                style={styles.input}
                editable={!busy}
                onSubmitEditing={onLink}
                returnKeyType="go"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton label="Link device" onPress={onLink} busy={busy} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  hero: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 24,
    gap: 10,
  },
  logoWrap: {
    marginBottom: 8,
  },
  logo: { width: 148, height: 148, resizeMode: 'contain' },
  brand: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.parchment,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.mist,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 24,
  },
  command: {
    fontFamily: fonts.bodySemi,
    color: colors.brass,
  },
  form: {
    gap: 10,
    paddingTop: 16,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.brass,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.bodySemi,
    fontSize: 22,
    letterSpacing: 3,
    color: colors.ink,
    textAlign: 'center',
  },
  error: {
    fontFamily: fonts.body,
    color: '#FFD2C8',
    fontSize: 14,
  },
});
