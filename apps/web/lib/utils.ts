import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rejeita IDs corrompidos (cuid/uuid-like) antes de chamar APIs. */
export function isLikelyDbId(id: unknown): boolean {
  if (id == null) return false;
  const s = String(id).trim();
  if (!s) return false;
  return s.length >= 12 && s.length <= 64 && /^[a-z0-9_-]+$/i.test(s);
}

export function formatCurrency(amount: number | null | undefined, currency: string = 'USD'): string {
  const val = amount ?? 0;
  return new Intl.NumberFormat('es-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatPercent(value: number | null | undefined): string {
  return `${value ?? 0}%`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: '#94a3b8', PLANNING: '#60B5FF', IN_PROGRESS: '#f59e0b',
    ON_HOLD: '#ef4444', COMPLETED: '#22c55e', CANCELLED: '#6b7280',
    BACKLOG: '#94a3b8', TODO: '#60B5FF', IN_REVIEW: '#a855f7', DONE: '#22c55e',
  };
  return colors?.[status] ?? '#94a3b8';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444', CRITICAL: '#dc2626',
  };
  return colors?.[priority] ?? '#94a3b8';
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name.split(' ').map((n: string) => n?.[0] ?? '').join('').toUpperCase().slice(0, 2);
}
