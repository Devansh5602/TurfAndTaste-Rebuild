import { SEMANTIC_COLOR_KEYS, THEME_NAMES, themes } from './colors';

function themeBlock(name: (typeof THEME_NAMES)[number]): string {
  const colors = themes[name];
  const declarations = SEMANTIC_COLOR_KEYS.map((key) => `  --tt-${key}: ${colors[key]};`).join('\n');
  if (name === 'clubhouse-ivory') {
    return `:root,\n[data-theme="${name}"] {\n${declarations}\n}`;
  }
  return `[data-theme="${name}"] {\n${declarations}\n}`;
}

export function renderThemesCss(): string {
  return `${THEME_NAMES.map((name) => themeBlock(name)).join('\n\n')}\n`;
}
