import { MenuButton } from '@/components/MenuButton';
import { ScreenShell } from '@/components/ScreenShell';
import { useLink } from '@/src/auth/LinkContext';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const MENUS = [
  { label: 'Steps', href: '/(app)/steps' as const },
  { label: 'Activity', href: '/(app)/activity' as const },
] as const;

export default function HomeScreen() {
  const { playerName, refreshPlayerName } = useLink();

  useFocusEffect(
    useCallback(() => {
      void refreshPlayerName();
    }, [refreshPlayerName]),
  );

  return (
    <ScreenShell
      title={`Welcome, ${playerName ?? 'Adventurer'}`}
      scroll
      footer={
        <MenuButton
          label="Settings"
          subtle
          onPress={() => router.push('/(app)/settings')}
        />
      }
    >
      <View style={{ gap: 12 }}>
        {MENUS.map((item, index) => (
          <Animated.View
            key={item.href}
            entering={FadeInDown.delay(80 + index * 70).duration(450)}
          >
            <MenuButton label={item.label} onPress={() => router.push(item.href)} />
          </Animated.View>
        ))}
      </View>
    </ScreenShell>
  );
}
