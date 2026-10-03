'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioPrimitive from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from './cn';

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-11 items-center justify-center rounded-sm border border-border bg-surface text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check aria-hidden="true" className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function RadioGroup(props: ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className="grid gap-3" {...props} />;
}

export function Radio({ className, ...props }: ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        'size-11 rounded-full border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=checked]:border-primary',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="flex items-center justify-center">
        <span className="size-2.5 rounded-full bg-primary" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Item>
  );
}
