'use client';

import { RefreshCw, X } from 'lucide-react';

type ScanProgressRingProps = {
  /** 0–100 */
  percent: number;
  state?: 'running' | 'error' | 'done';
  size?: number;
  onRetry?: () => void;
  className?: string;
  /** Light ring on colored buttons */
  tone?: 'default' | 'onDark';
};

/** Anel de progresso determinado com % no centro; erro = vermelho + X + refresh. */
export function ScanProgressRing({
  percent,
  state = 'running',
  size = 22,
  onRetry,
  className = '',
  tone = 'default',
}: ScanProgressRingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const stroke = Math.max(2, Math.round(size / 9));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  if (state === 'error') {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <span
          className="relative inline-flex items-center justify-center rounded-full bg-red-600 text-white"
          style={{ width: size, height: size }}
          title="Erro"
        >
          <X style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={3} />
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white p-0.5 text-red-700 hover:bg-red-50"
            title="Reiniciar"
            aria-label="Reiniciar busca"
          >
            <RefreshCw style={{ width: size * 0.55, height: size * 0.55 }} />
          </button>
        )}
      </span>
    );
  }

  const track = tone === 'onDark' ? 'rgba(255,255,255,0.35)' : '#e5e7eb';
  const fill =
    state === 'done'
      ? tone === 'onDark'
        ? '#bbf7d0'
        : '#059669'
      : tone === 'onDark'
        ? '#fff'
        : '#d97706';
  const label = tone === 'onDark' ? 'text-white' : 'text-gray-800';

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      role="progressbar"
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fill}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums leading-none ${label}`}
        style={{ fontSize: Math.max(7, size * 0.32) }}
      >
        {pct}
      </span>
    </span>
  );
}

/** Estimativa suave 0–88% enquanto o servidor ainda não reporta fases. */
export function estimateScanPercent(elapsedMs: number, serverPct?: number | null): number {
  const expectedMs = 240_000;
  const t = Math.min(1, elapsedMs / expectedMs);
  // ease-out toward 88%
  const soft = Math.round(88 * (1 - Math.pow(1 - t, 1.6)));
  const fromServer = serverPct != null && serverPct > 0 ? Math.min(95, serverPct) : 0;
  return Math.max(3, soft, fromServer);
}
