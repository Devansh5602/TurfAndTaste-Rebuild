export const SEMANTIC_COLOR_KEYS = [
  'background',
  'surface',
  'surface-muted',
  'primary',
  'primary-foreground',
  'accent',
  'accent-muted',
  'text-primary',
  'text-secondary',
  'border',
  'success',
  'warning',
  'danger',
  'info',
  'disabled',
  'focus-ring',
  'overlay',
] as const;

export type SemanticColorKey = (typeof SEMANTIC_COLOR_KEYS)[number];

export type ThemeColors = Record<SemanticColorKey, string>;

export const THEME_NAMES = ['clubhouse-ivory', 'midnight-ivory'] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export const DEFAULT_THEME: ThemeName = 'clubhouse-ivory';

export const THEME_STORAGE_KEY = 'turf-and-taste-theme';

export const themes: Record<ThemeName, ThemeColors> = {
  'clubhouse-ivory': {
    background: '#F7F3EB',
    surface: '#FFFDF8',
    'surface-muted': '#EFE6D6',
    primary: '#1B4332',
    'primary-foreground': '#F7F3EB',
    accent: '#8A6232',
    'accent-muted': '#E8D4B4',
    'text-primary': '#1C1915',
    'text-secondary': '#5C564E',
    border: '#E0D5C5',
    success: '#166534',
    warning: '#92400E',
    danger: '#991B1B',
    info: '#1E3A8A',
    disabled: '#68625A',
    'focus-ring': '#1B4332',
    overlay: 'rgb(28 25 21 / 0.56)',
  },
  'midnight-ivory': {
    background: '#121410',
    surface: '#1C1F1A',
    'surface-muted': '#282C26',
    primary: '#E7DCC8',
    'primary-foreground': '#1A1714',
    accent: '#E0C08A',
    'accent-muted': '#3D3426',
    'text-primary': '#F6F1E8',
    'text-secondary': '#C9BFB0',
    border: '#3C4238',
    success: '#86EFAC',
    warning: '#FBBF24',
    danger: '#FCA5A5',
    info: '#93C5FD',
    disabled: '#A8A29E',
    'focus-ring': '#E7DCC8',
    overlay: 'rgb(0 0 0 / 0.64)',
  },
};

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return THEME_NAMES.some((theme) => theme === value);
}

export function parseStoredTheme(value: string | null | undefined): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME;
}

export function colorChannels(hex: string): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const digits = match?.[1];
  if (!digits) {
    throw new Error(`Expected a 6-digit hex color, received ${hex}`);
  }
  const red = Number.parseInt(digits.slice(0, 2), 16);
  const green = Number.parseInt(digits.slice(2, 4), 16);
  const blue = Number.parseInt(digits.slice(4, 6), 16);
  return `${red} ${green} ${blue}`;
}

export function themeChannelVars(theme: ThemeName): Record<string, string> {
  const colors = themes[theme];
  return Object.fromEntries(
    SEMANTIC_COLOR_KEYS.flatMap((key) => {
      const value = colors[key];
      if (!value.startsWith('#')) {
        return [[`--tt-${key}`, value]];
      }
      return [[`--tt-${key}`, colorChannels(value)]];
    }),
  );
}
