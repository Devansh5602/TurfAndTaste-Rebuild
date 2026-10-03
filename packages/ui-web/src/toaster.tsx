'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster({ theme }: { theme: 'light' | 'dark' }) {
  return <SonnerToaster theme={theme} richColors closeButton />;
}

export { toast } from 'sonner';
