import {Platform} from 'react-native';

const monoFamily = Platform.select({
  ios: 'SF Mono',
  android: 'monospace',
  default: 'monospace',
});

export const typography = {
  family: {
    system: undefined,
    mono: monoFamily,
  },

  size: {
    xs: 9,
    sm: 11,
    md: 13,
    base: 15,
    lg: 18,
    xl: 20,
    hero: 64,
  },

  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  letterSpacing: {
    tight: -3,
    normal: 0,
    wide: 1,
    wider: 2,
    widest: 3,
  },
} as const;
