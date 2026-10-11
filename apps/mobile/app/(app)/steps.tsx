import { Panel, ScreenShell } from '@/components/ScreenShell';
import { type } from '@/src/theme';
import { Text } from 'react-native';

export default function StepsScreen() {
  return (
    <ScreenShell
      title="Steps"
      subtitle="Walking progress that Lords of Minecraft can accept."
      showBack
    >
      <Panel>
        <Text style={type.bodyOnPanel}>
          Step sync from Health Connect / Core Motion will land here after account linking is
          backed by the PocketBase redeem route.
        </Text>
      </Panel>
    </ScreenShell>
  );
}
