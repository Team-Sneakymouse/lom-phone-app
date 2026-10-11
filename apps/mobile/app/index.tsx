import { useLink } from '@/src/auth/LinkContext';
import { colors } from '@/src/theme';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { ready, session } = useLink();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator color={colors.brass} />
      </View>
    );
  }

  if (session) return <Redirect href="/(app)/home" />;
  return <Redirect href="/welcome" />;
}
