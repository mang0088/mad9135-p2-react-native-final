import { MD3LightTheme } from 'react-native-paper';

/**
 * Spooncular design tokens.
 *
 * A light, food-editorial system: warm cream page, white cards, deep green
 * brand surfaces and a warm culinary accent. Everything the UI needs is
 * declared once here so screens never re-declare colours or measurements.
 */

export const palette = {
  primary: '#245B3D',
  primaryDark: '#17412C',
  primaryLight: '#DDEFE2',
  secondary: '#E7A84B',

  background: '#FBF8F1',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2E9',

  text: '#20271F',
  textSecondary: '#697268',

  border: '#E3E6DC',
  error: '#B93838',
  success: '#277447',

  // Derived surfaces used by image fallbacks so they read as designed
  // elements rather than broken images.
  fallbackBg: '#F0F2E9',
  fallbackInk: '#A9B3A4',
  overlay: 'rgba(23, 65, 44, 0.55)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  hero: 30,
  title: 25,
  section: 19,
  card: 16,
  body: 15,
  supporting: 13,
  meta: 11.5,
};

export const layout = {
  screenPadding: spacing.xl, // 20pt horizontal gutters on iPhone 15
  maxContentWidth: 720,
  controlHeight: 48,
  touchTarget: 44,
  icon: 22,
  iconSmall: 16,
  iconLarge: 28,
  // 16:9 for editorial food photography across cards and video thumbnails.
  mediaRatio: 16 / 9,
  // Menu cards are fixed-width so the carousel peeks at the next card.
  menuCardWidth: 168,
  menuCardHeight: 236,
  videoCardWidth: 260,
};

export const tokens = {
  palette,
  spacing,
  radius,
  typography,
  layout,
  screenPadding: layout.screenPadding,
  controlHeight: layout.controlHeight,
  contentMaxWidth: layout.maxContentWidth,
};

export const appTheme = {
  ...MD3LightTheme,
  roundness: radius.md,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: palette.primaryLight,
    onPrimaryContainer: palette.primaryDark,
    secondary: palette.secondary,
    onSecondary: '#3A2A0B',
    secondaryContainer: '#FBEBD1',
    onSecondaryContainer: '#3A2A0B',
    background: palette.background,
    onBackground: palette.text,
    surface: palette.surface,
    onSurface: palette.text,
    surfaceVariant: palette.surfaceMuted,
    onSurfaceVariant: palette.textSecondary,
    outline: palette.border,
    outlineVariant: palette.border,
    error: palette.error,
    onError: '#FFFFFF',
    errorContainer: '#FBE3E3',
    onErrorContainer: '#5C1A1A',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: palette.surface,
      level2: palette.surface,
      level3: palette.surfaceMuted,
      level4: palette.surfaceMuted,
      level5: palette.surfaceMuted,
    },
  },
};

/** Card surface used across cards so borders/shadows stay consistent. */
export const cardSurface = {
  backgroundColor: palette.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: palette.border,
};