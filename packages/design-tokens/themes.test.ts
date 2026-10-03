import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SEMANTIC_COLOR_KEYS,
  THEME_NAMES,
  contrastRatio,
  parseStoredTheme,
  renderThemesCss,
  themes,
  typographyRoles,
} from './src/index';

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

describe('design tokens', () => {
  it('keeps the committed stylesheet aligned with the token source', () => {
    const committed = readFileSync(path.join(packageRoot, 'themes.css'), 'utf8');
    expect(committed).toBe(renderThemesCss());
  });

  it('defines every semantic color in both themes', () => {
    for (const theme of THEME_NAMES) {
      for (const key of SEMANTIC_COLOR_KEYS) {
        expect(themes[theme][key].length).toBeGreaterThan(0);
      }
    }
  });

  it('meets WCAG AA contrast for text and brand pairs', () => {
    const pairs = [
      ['text-primary', 'background', 4.5],
      ['text-primary', 'surface', 4.5],
      ['text-secondary', 'background', 4.5],
      ['primary-foreground', 'primary', 4.5],
      ['primary-foreground', 'danger', 4.5],
      ['primary-foreground', 'success', 4.5],
      ['focus-ring', 'background', 3],
    ] as const;

    for (const theme of THEME_NAMES) {
      for (const [foreground, background, minimum] of pairs) {
        const ratio = contrastRatio(themes[theme][foreground], themes[theme][background]);
        expect(ratio, `${theme} ${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  it('falls back to Clubhouse Ivory for unknown stored themes', () => {
    expect(parseStoredTheme(null)).toBe('clubhouse-ivory');
    expect(parseStoredTheme('system')).toBe('clubhouse-ivory');
    expect(parseStoredTheme('midnight-ivory')).toBe('midnight-ivory');
  });

  it('defines the typography roles used by both clients', () => {
    expect(typographyRoles).toContain('display');
    expect(typographyRoles).toContain('caption');
  });
});
