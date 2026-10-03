import { LoadingState } from '@turf-and-taste/ui-web';

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6">
      <LoadingState label="Loading foundation" />
    </main>
  );
}
