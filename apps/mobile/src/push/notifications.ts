import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PREF_KEY = 'lom.push.notifyJobs.v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function pushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function ensureJobsAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('jobs', {
    name: 'Job Board',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Request OS permission and return an Expo push token, or null if denied/unavailable. */
export async function obtainExpoPushToken(): Promise<string | null> {
  if (!pushSupported()) return null;
  if (!Device.isDevice) {
    throw new Error('Push requires a physical device.');
  }

  await ensureJobsAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    '';

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      /firebase|googleServicesFile|FCM|GoogleService/i.test(msg) ||
      (Platform.OS === 'android' && /initializeApp/i.test(msg))
    ) {
      throw new Error(
        'Android push needs Firebase (google-services.json). See apps/mobile/README.md — Push (FCM).',
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}

export { PREF_KEY };
