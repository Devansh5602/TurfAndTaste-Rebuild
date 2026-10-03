import type { ReactNode } from 'react';

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-label text-text-primary" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-caption text-danger" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-text-secondary" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-h1 font-bold text-text-primary">{title}</h1>
      {description ? <p className="text-body text-text-secondary">{description}</p> : null}
    </header>
  );
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-h2 font-semibold text-text-primary">{title}</h2>
      {description ? <p className="text-body-small text-text-secondary">{description}</p> : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
      <h2 className="text-title font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 text-body-small text-text-secondary">{description}</p>
    </div>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-body text-text-secondary" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      {label}
    </div>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-danger bg-surface px-4 py-5" role="alert">
      <h2 className="text-title font-semibold text-danger">{title}</h2>
      <p className="mt-1 text-body-small text-text-secondary">{description}</p>
    </div>
  );
}
