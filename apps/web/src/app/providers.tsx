'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_THEME, THEME_NAMES, THEME_STORAGE_KEY } from '@turf-and-taste/design-tokens';
import { Toaster } from '@turf-and-taste/ui-web';
import { ThemeProvider, useTheme } from 'next-themes';
import { useState, type ReactNode } from 'react';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === 'midnight-ivory' ? 'dark' : 'light'} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme={DEFAULT_THEME}
      disableTransitionOnChange
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      themes={[...THEME_NAMES]}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
