'use client';

import { Button, ErrorState } from '@turf-and-taste/ui-web';

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6">
      <ErrorState
        description="The page could not be displayed. Try again."
        title="This screen failed to load"
      />
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
