'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeAtRiskBanner({ companyId }: { companyId: string | null }) {
  const ft = useForgeT();
  const [items, setItems] = useState<{ courseId: string; title: string; count: number }[]>([]);

  useEffect(() => {
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    fetch(`/api/forge/at-risk-summary${q}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
  }, [companyId]);

  if (items.length === 0) return null;

  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="h-4 w-4" />
        {total} {ft('forge.atRisk.banner')} {items.length} {ft('forge.atRisk.courses')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.courseId}>
            <Link
              href={`/hub/forge/cursos/${i.courseId}/analytics`}
              className="rounded-lg bg-amber-200/80 px-2 py-1 text-xs font-semibold hover:bg-amber-300"
            >
              {i.title} ({i.count})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
