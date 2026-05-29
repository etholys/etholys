'use client';

import type { ReactNode } from 'react';

type Props = { className?: string; children?: ReactNode };

export function StateLoading({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-10 ${className}`.trim()}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300/40 border-t-slate-600" aria-label="Loading" />
    </div>
  );
}

export function StateEmpty({ title, description, className = '', action }: Props & { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center ${className}`.trim()}>
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

type ErrorTone = 'danger' | 'amber';

const ERROR_TONE: Record<
  ErrorTone,
  { box: string; title: string; text: string; btn: string }
> = {
  danger: {
    box: 'border-red-200 bg-red-50/90',
    title: 'text-red-900',
    text: 'text-red-800',
    btn: 'text-red-900 decoration-red-300 hover:decoration-red-500',
  },
  amber: {
    box: 'border-amber-200 bg-amber-50/90',
    title: 'text-amber-950',
    text: 'text-amber-950/95',
    btn: 'text-amber-950 decoration-amber-300 hover:decoration-amber-600',
  },
};

export function StateError({
  title,
  message,
  onRetry,
  className = '',
  retryLabel = 'Tentar de novo',
  tone = 'danger',
}: Props & { title?: string; message: string; onRetry?: () => void; retryLabel?: string; tone?: ErrorTone }) {
  const c = ERROR_TONE[tone];
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-left ${c.box} ${className}`.trim()}
      role="alert"
    >
      {title && <p className={`text-sm font-semibold ${c.title}`}>{title}</p>}
      <p className={`text-sm ${c.text} ${title ? 'mt-1' : ''}`}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`mt-2 text-sm font-medium underline ${c.btn}`}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
