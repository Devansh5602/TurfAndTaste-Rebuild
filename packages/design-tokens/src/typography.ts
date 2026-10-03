export const fontFamily = {
  sans: 'Plus Jakarta Sans',
} as const;

export const typographyRoles = [
  'display',
  'h1',
  'h2',
  'h3',
  'title',
  'body',
  'body-small',
  'label',
  'caption',
] as const;

export type TypographyRole = (typeof typographyRoles)[number];

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: 400 | 500 | 600 | 700;
}

export const typography: Record<TypographyRole, TypeStyle> = {
  display: { fontSize: 40, lineHeight: 48, fontWeight: 700 },
  h1: { fontSize: 32, lineHeight: 40, fontWeight: 700 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: 600 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: 600 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: 600 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  'body-small': { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
};
