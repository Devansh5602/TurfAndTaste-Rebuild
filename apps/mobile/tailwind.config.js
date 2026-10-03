/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.ts', './src/**/*.{ts,tsx}', '../../packages/ui-native/src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--tt-background) / <alpha-value>)',
        surface: 'rgb(var(--tt-surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--tt-surface-muted) / <alpha-value>)',
        primary: 'rgb(var(--tt-primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--tt-primary-foreground) / <alpha-value>)',
        accent: 'rgb(var(--tt-accent) / <alpha-value>)',
        'accent-muted': 'rgb(var(--tt-accent-muted) / <alpha-value>)',
        'text-primary': 'rgb(var(--tt-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--tt-text-secondary) / <alpha-value>)',
        border: 'rgb(var(--tt-border) / <alpha-value>)',
        success: 'rgb(var(--tt-success) / <alpha-value>)',
        warning: 'rgb(var(--tt-warning) / <alpha-value>)',
        danger: 'rgb(var(--tt-danger) / <alpha-value>)',
        info: 'rgb(var(--tt-info) / <alpha-value>)',
        disabled: 'rgb(var(--tt-disabled) / <alpha-value>)',
        'focus-ring': 'rgb(var(--tt-focus-ring) / <alpha-value>)',
        overlay: 'var(--tt-overlay)',
      },
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold: ['PlusJakartaSans_700Bold'],
      },
      fontSize: {
        display: ['40px', { lineHeight: '48px' }],
        h1: ['32px', { lineHeight: '40px' }],
        h2: ['24px', { lineHeight: '32px' }],
        h3: ['20px', { lineHeight: '28px' }],
        title: ['18px', { lineHeight: '26px' }],
        body: ['16px', { lineHeight: '24px' }],
        'body-small': ['14px', { lineHeight: '20px' }],
        label: ['14px', { lineHeight: '20px' }],
        caption: ['12px', { lineHeight: '16px' }],
      },
    },
  },
};
