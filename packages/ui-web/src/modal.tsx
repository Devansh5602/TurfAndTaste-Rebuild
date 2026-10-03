'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-overlay" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 text-text-primary shadow-lg focus-visible:outline-none">
          <Dialog.Title className="text-h3 font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-body-small text-text-secondary">
            {description}
          </Dialog.Description>
          <div className="mt-4">{children}</div>
          <Dialog.Close className="mt-6 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
            Close
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
