import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border border-border bg-surface-muted px-3 text-label text-text-primary',
        className,
      )}
      {...props}
    />
  );
}

const badgeTones = {
  neutral: 'bg-surface-muted text-text-primary',
  success: 'bg-surface-muted text-success',
  warning: 'bg-surface-muted text-warning',
  danger: 'bg-surface-muted text-danger',
  info: 'bg-surface-muted text-info',
} as const;

export type StatusTone = keyof typeof badgeTones;

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-caption', badgeTones[tone], className)}
      {...props}
    />
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: Exclude<StatusTone, 'neutral'>;
  children: ReactNode;
}) {
  return (
    <Badge tone={tone} role="status">
      {children}
    </Badge>
  );
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      aria-label={name}
      role="img"
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full bg-accent-muted text-label text-text-primary',
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-0 border-t border-border', className)} {...props} />;
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-surface-muted', className)} {...props} />;
}
