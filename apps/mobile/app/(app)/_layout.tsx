import { useLink } from '@/src/auth/LinkContext';
import { colors } from '@/src/theme';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function AppLayout() {
  const { ready, session } = useLink();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        <ActivityIndicator color={colors.brass} />
      </View>
    );
  }
  if (!session) return <Redirect href="/welcome" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="job-board" />
      <Stack.Screen name="steps" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
