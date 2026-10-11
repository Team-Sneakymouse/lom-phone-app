import { Easing, makeMutable, withRepeat, withTiming } from 'react-native-reanimated';

/** Survives screen remounts so yaw does not jump on navigation. */
export const panoramaProgress = makeMutable(0);
export const panoramaTravel = makeMutable(1);

let started = false;

export function ensurePanoramaAnimation() {
  if (started) return;
  started = true;
  panoramaProgress.value = withRepeat(
    withTiming(1, { duration: 90_000, easing: Easing.linear }),
    -1,
    false,
  );
}
