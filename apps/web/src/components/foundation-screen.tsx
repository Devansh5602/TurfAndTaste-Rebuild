'use client';

import { useQuery } from '@tanstack/react-query';
import { getHealth } from '@turf-and-taste/api-client';
import { SEMANTIC_COLOR_KEYS, themes } from '@turf-and-taste/design-tokens';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  SectionHeader,
} from '@turf-and-taste/ui-web';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function FoundationScreen() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const activeTheme =
    mounted && theme === 'midnight-ivory' ? 'midnight-ivory' : 'clubhouse-ivory';
  const [note, setNote] = useState('');
  const health = useQuery({
    queryKey: ['health', apiUrl],
    queryFn: () => getHealth(apiUrl),
    enabled: false,
    retry: false,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <PageHeader
        description="Phase 0 proves the web shell, shared tokens, and both global themes. Product screens are not part of this phase."
        title="Turf & Taste"
      />
      <Card className="flex flex-col gap-4">
        <SectionHeader title="Theme" />
        <Badge tone="neutral">{activeTheme}</Badge>
        <Button
          onClick={() =>
            setTheme(activeTheme === 'clubhouse-ivory' ? 'midnight-ivory' : 'clubhouse-ivory')
          }
        >
          Switch theme
        </Button>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SEMANTIC_COLOR_KEYS.map((key) => (
            <div className="overflow-hidden rounded-md border border-border" key={key}>
              <div className="h-11" style={{ background: themes[activeTheme][key] }} />
              <p className="px-2 py-1 text-caption text-text-secondary">{key}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="flex flex-col gap-4">
        <SectionHeader description="The field is local UI state only." title="Form primitive" />
        <FormField hint="Nothing is saved." htmlFor="foundation-note" label="Note">
          <Input id="foundation-note" onChange={(event) => setNote(event.target.value)} value={note} />
        </FormField>
      </Card>
      <Card className="flex flex-col gap-4">
        <SectionHeader title="API client" />
        <Button
          onClick={() => {
            void health.refetch();
          }}
          variant="secondary"
        >
          Check API health
        </Button>
        {health.data ? <Badge tone="success">API {health.data.data.status}</Badge> : null}
        {health.isError ? (
          <ErrorState description="Start the API to verify the health route." title="API unavailable" />
        ) : null}
      </Card>
      <EmptyState
        description="Customer and admin screens begin in later phases."
        title="No product modules yet"
      />
    </main>
  );
}
