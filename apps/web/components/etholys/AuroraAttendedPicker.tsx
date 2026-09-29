'use client';

import Link from 'next/link';
import { useApp } from '@/app/providers';
import { useAuroraAttended } from '@/components/etholys/AuroraAttendedContext';

/** Seletor interno AURORA — negócio atendido (camada 2). */
export function AuroraAttendedPicker({ collapsed }: { collapsed?: boolean }) {
  const { locale } = useApp();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const { selection, setSelection, options, loading, canManage } = useAuroraAttended();

  const copy =
    loc === 'es'
      ? {
          label: 'Negocio atendido',
          empty: 'Sin negocio en cartera',
          pick: 'Elegí un negocio…',
          invite: 'Invitar técnicos',
          hint: 'Incubadora → negocio externo (no es POLARIS).',
        }
      : loc === 'en'
        ? {
            label: 'Attended business',
            empty: 'No businesses in portfolio',
            pick: 'Pick a business…',
            invite: 'Invite technicians',
            hint: 'Incubator → external business (not POLARIS).',
          }
        : {
            label: 'Negócio atendido',
            empty: 'Sem negócios na carteira',
            pick: 'Escolhe um negócio…',
            invite: 'Convidar técnicos',
            hint: 'Incubadora → negócio externo (não é POLARIS).',
          };

  if (collapsed) return null;

  const value = selection ? `${selection.companyId}::${selection.engagementId}` : '';

  return (
    <div className="space-y-1.5">
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">{copy.label}</p>
      <select
        value={value}
        disabled={loading || options.length === 0}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) {
            setSelection(null);
            return;
          }
          const [companyId, engagementId] = raw.split('::');
          const row = options.find((o) => o.companyId === companyId && o.engagementId === engagementId);
          if (!row) {
            setSelection(null);
            return;
          }
          setSelection({
            companyId: row.companyId,
            engagementId: row.engagementId,
            name: row.name,
            engagementTitle: row.engagementTitle,
          });
        }}
        className="w-full rounded-lg border border-white/15 bg-white/5 px-2 py-2 text-xs text-white outline-none focus:border-amber-400/50"
      >
        <option value="">{options.length ? copy.pick : copy.empty}</option>
        {options.map((row) => (
          <option key={`${row.companyId}-${row.engagementId}`} value={`${row.companyId}::${row.engagementId}`}>
            {row.shortName || row.name}
            {row.engagementTitle ? ` · ${row.engagementTitle}` : ''}
          </option>
        ))}
      </select>
      <p className="px-0.5 text-[10px] leading-snug text-white/35">{copy.hint}</p>
      {canManage ? (
        <Link
          href="/hub/workspace/team"
          className="block px-0.5 text-[11px] font-medium text-amber-200/80 hover:text-amber-100 hover:underline"
        >
          {copy.invite}
        </Link>
      ) : null}
    </div>
  );
}
