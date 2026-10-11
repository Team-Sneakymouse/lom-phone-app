import {
  ensurePanoramaAnimation,
  panoramaProgress,
  panoramaTravel,
} from '@/src/panorama/animation';
import { colors } from '@/src/theme';
import { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

/**
 * Lords of Minecraft titlescreen panorama (cube faces 0–3 as a yaw strip).
 * Mount once at the app root — animation state lives in `src/panorama/animation`.
 */
export function PanoramaBackground() {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const imageH = Math.ceil(screenH * 1.12);
  const imageW = imageH * 4;
  const travel = Math.max(imageW - screenW, imageW * 0.5);

  useEffect(() => {
    panoramaTravel.value = travel;
    ensurePanoramaAnimation();
  }, [travel]);

  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -panoramaProgress.value * panoramaTravel.value }],
  }));

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View
        style={[
          { width: imageW, height: imageH, marginTop: -(imageH - screenH) / 2 },
          panStyle,
        ]}
      >
        <Image
          source={require('../assets/panorama/panorama_strip.jpg')}
          style={{ width: imageW, height: imageH }}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      <View style={[styles.fill, styles.veil]} />
      <View style={[styles.fill, { backgroundColor: colors.overlay }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  veil: {
    backgroundColor: 'rgba(10, 18, 16, 0.18)',
  },
});
