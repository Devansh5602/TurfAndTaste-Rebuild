import { colorChannels } from './colors';

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [red = '0', green = '0', blue = '0'] = colorChannels(hex).split(' ');
  return (
    0.2126 * channelLuminance(Number(red)) +
    0.7152 * channelLuminance(Number(green)) +
    0.0722 * channelLuminance(Number(blue))
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
