import { StyleSheet, TextStyle } from 'react-native';

/** Visual tokens for the Lords of Minecraft phone companion. */
export const colors = {
  ink: '#0E1C1A',
  moss: '#1F3D34',
  mist: '#E7F0EA',
  brass: '#C4A35A',
  brassDeep: '#8E7335',
  parchment: '#F3EDE2',
  danger: '#A33B2B',
  overlay: 'rgba(8, 18, 16, 0.42)',
  panel: 'rgba(243, 237, 226, 0.92)',
  panelBorder: 'rgba(142, 115, 53, 0.35)',
} as const;

export const fonts = {
  display: 'Cinzel_700Bold',
  displayRegular: 'Cinzel_400Regular',
  body: 'SourceSans3_400Regular',
  bodySemi: 'SourceSans3_600SemiBold',
} as const;

export const type = StyleSheet.create({
  kicker: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.brass,
    marginBottom: 8,
  } satisfies TextStyle,
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    color: colors.parchment,
  } satisfies TextStyle,
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.mist,
  } satisfies TextStyle,
  bodyOnPanel: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.moss,
  } satisfies TextStyle,
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.mist,
  } satisfies TextStyle,
});
