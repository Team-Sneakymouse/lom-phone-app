import { Panel, ScreenShell } from '@/components/ScreenShell';
import { type } from '@/src/theme';
import { Text } from 'react-native';

export default function ActivityScreen() {
  return (
    <ScreenShell
      title="Activity"
      subtitle="Accessible progress and daily routes."
      showBack
    >
      <Panel>
        <Text style={type.bodyOnPanel}>
          Placeholder for community and accessible activity that stays separate from raw step
          counts.
        </Text>
      </Panel>
    </ScreenShell>
  );
}
