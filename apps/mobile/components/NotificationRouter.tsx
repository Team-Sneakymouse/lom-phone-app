import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

/** Opens Job Board when a job-board push is tapped. */
export function NotificationRouter() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        url?: string;
      };
      if (data?.url === '/(app)/job-board' || data?.url === '/job-board') {
        router.push('/(app)/job-board');
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
