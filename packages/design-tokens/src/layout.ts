export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const shadow = {
  sm: '0 1px 2px rgb(28 25 21 / 0.08)',
  md: '0 8px 24px rgb(28 25 21 / 0.12)',
  lg: '0 16px 40px rgb(28 25 21 / 0.16)',
} as const;

export const layout = {
  phoneWidths: [360, 375, 390, 412, 430] as const,
  contentMaxWidthPx: 1120,
  touchTargetMinPx: 44,
} as const;
